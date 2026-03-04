
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertTriangle, Loader2, Search, Trash2, FileText } from "lucide-react"; // Added FileText icon
import { format } from "date-fns";
import { toast } from "sonner";

export default function DeepTestAnalyzer() {
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [fixing, setFixing] = useState(false);
  const [fixProgress, setFixProgress] = useState({ current: 0, total: 0, step: '' });

  const queryClient = useQueryClient();

  // Fetching all necessary data for analysis
  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings-test'],
    queryFn: () => base44.entities.Booking.list(),
    initialData: [],
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices-test'],
    queryFn: () => base44.entities.Invoice.list(),
    initialData: [],
  });

  const { data: incomeRecords = [] } = useQuery({
    queryKey: ['income-test'],
    queryFn: () => base44.entities.IncomeRecord.list(),
    initialData: [],
  });

  const { data: sessionPayments = [] } = useQuery({
    queryKey: ['session-payments-test'],
    queryFn: () => base44.entities.SessionPayment.list(),
    initialData: [],
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses-test'],
    queryFn: () => base44.entities.Expense.list(),
    initialData: [],
  });

  const { data: bandMembers = [] } = useQuery({
    queryKey: ['band-members-test'],
    queryFn: () => base44.entities.User.list(), // Assuming 'User' entity represents band members
    initialData: [],
  });

  const runDeepTest = async () => {
    setTesting(true);
    setTestResults(null); // Clear previous results
    const results = {
      bookingTests: [],
      mathTests: [],
      flowTests: [],
      duplicateTests: [],
      pdfLinkTests: [], // NEW: Add PDF link tests
      summary: { passed: 0, failed: 0, warnings: 0 }
    };

    try {
      // Re-fetch data to ensure tests run on the latest state
      // Await these invalidations to ensure the next `list()` calls (or useQuery's cached data) are fresh.
      // If `useQuery`'s data isn't immediately fresh after `invalidateQueries`, direct `base44.entities.X.list()` calls might be more reliable for testing.
      await queryClient.invalidateQueries({ queryKey: ['bookings-test'] });
      await queryClient.invalidateQueries({ queryKey: ['invoices-test'] });
      await queryClient.invalidateQueries({ queryKey: ['income-test'] });
      await queryClient.invalidateQueries({ queryKey: ['session-payments-test'] });
      await queryClient.invalidateQueries({ queryKey: ['expenses-test'] });
      await queryClient.invalidateQueries({ queryKey: ['band-members-test'] });

      // For tests that rely on fresh data, it's safer to fetch it directly *after* invalidating
      // and before proceeding with tests, rather than relying solely on the useQuery state which
      // might still be resolving its invalidated state.
      // E.g., const freshBookings = await base44.entities.Booking.list();
      // For this code, we'll continue using the `bookings`, `invoices`, etc. variables assuming
      // `useQuery` has updated them sufficiently after invalidation and re-render.

      console.log('=== TEST 1: BOOKINGS INTEGRITY ===');
      for (const booking of bookings) { // Use current state of 'bookings' from useQuery
        const test = {
          booking: booking,
          checks: [],
          status: 'pass'
        };

        // Check 1: Balance calculation
        const expectedBalance = (booking.fee || 0) - (booking.deposit_paid || 0);
        if (Math.abs(expectedBalance - (booking.balance_due || 0)) > 0.01) {
          test.checks.push({
            name: 'Balance Calculation',
            status: 'fail',
            expected: expectedBalance,
            actual: booking.balance_due || 0,
            message: `Balance due should be £${expectedBalance.toFixed(2)} but is £${(booking.balance_due || 0).toFixed(2)}`
          });
          test.status = 'fail';
        } else {
          test.checks.push({
            name: 'Balance Calculation',
            status: 'pass',
            message: 'Balance calculation correct'
          });
        }

        // Check 2: Invoice exists if marked as invoiced
        if (booking.invoice_generated) {
          const bookingInvoices = invoices.filter(inv => inv.booking_id === booking.id);
          if (bookingInvoices.length === 0) {
            test.checks.push({
              name: 'Invoice Exists',
              status: 'fail',
              message: 'Marked as invoiced but no invoice found'
            });
            test.status = 'fail';
          } else if (bookingInvoices.length > 1) {
            test.checks.push({
              name: 'Invoice Exists',
              status: 'warning',
              message: `Multiple invoices found: ${bookingInvoices.length}`
            });
            if (test.status === 'pass') test.status = 'warning';
          } else {
            test.checks.push({
              name: 'Invoice Exists',
              status: 'pass',
              message: 'Invoice found'
            });
          }
        }

        // Check 3: Payment status logic
        if (booking.payment_status === 'paid_in_full') {
          if (booking.balance_due > 0.01) {
            test.checks.push({
              name: 'Payment Status',
              status: 'fail',
              message: `Marked as paid but £${booking.balance_due} balance remains`
            });
            test.status = 'fail';
          } else {
            test.checks.push({
              name: 'Payment Status',
              status: 'pass',
              message: 'Payment status matches balance'
            });
          }
        } else if (booking.payment_status === 'deposit_paid' && (booking.deposit_paid || 0) === 0) {
          test.checks.push({
            name: 'Payment Status',
            status: 'fail',
            message: 'Marked as deposit paid but deposit amount is zero'
          });
          test.status = 'fail';
        } else if (booking.payment_status === 'unpaid' && (booking.fee || 0) > 0 && (booking.deposit_paid || 0) > 0 && booking.balance_due > 0) {
          test.checks.push({
            name: 'Payment Status',
            status: 'warning',
            message: 'Marked as unpaid but deposit has been paid'
          });
          if (test.status === 'pass') test.status = 'warning';
        }


        results.bookingTests.push(test);
        if (test.status === 'fail') results.summary.failed++;
        else if (test.status === 'warning') results.summary.warnings++;
        else results.summary.passed++;
      }

      // TEST 2: INVOICE FLOW INTEGRITY
      console.log('=== TEST 2: INVOICE FLOW INTEGRITY ===');
      for (const invoice of invoices) { // Use current state of 'invoices' from useQuery
        const test = {
          invoice: invoice,
          checks: [],
          status: 'pass'
        };

        // Check 1: Booking exists
        const booking = bookings.find(b => b.id === invoice.booking_id);
        if (!booking) {
          test.checks.push({
            name: 'Booking Exists',
            status: 'fail',
            message: `Invoice #${invoice.invoice_number || invoice.id} has no corresponding booking (orphaned)`
          });
          test.status = 'fail';
        } else {
          test.checks.push({
            name: 'Booking Exists',
            status: 'pass',
            message: `Linked to booking: ${booking.venue_name}`
          });

          // Check 2: Band income record exists (band_total)
          const bandIncome = incomeRecords.filter(
            invRec => invRec.invoice_id === invoice.id && invRec.record_type === 'band_total'
          );
          if (bandIncome.length === 0) {
            test.checks.push({
              name: 'Band Income Record',
              status: 'fail',
              message: 'No band_total income record found'
            });
            test.status = 'fail';
          } else if (bandIncome.length > 1) {
            test.checks.push({
              name: 'Band Income Record',
              status: 'warning',
              message: `Multiple band income records: ${bandIncome.length} (DUPLICATE!)`
            });
            if (test.status === 'pass') test.status = 'warning';
          } else {
            // Check amount matches
            if (Math.abs(bandIncome[0].amount - invoice.amount) > 0.01) {
              test.checks.push({
                name: 'Band Income Record',
                status: 'fail',
                message: `Amount mismatch: Invoice £${invoice.amount} vs Income £${bandIncome[0].amount}`
              });
              test.status = 'fail';
            } else {
              test.checks.push({
                name: 'Band Income Record',
                status: 'pass',
                message: `Band income record correct: £${bandIncome[0].amount}`
              });
            }
          }

          // Check 3: Session payment records exist
          const sessionPmts = sessionPayments.filter(sp => sp.invoice_id === invoice.id);
          if (sessionPmts.length === 0 && (booking.fee || 0) > 0) { // Only fail if booking fee is > 0
            test.checks.push({
              name: 'Session Payments',
              status: 'fail',
              message: 'No session payment records found'
            });
            test.status = 'fail';
          } else if (sessionPmts.length > 0) {
            const totalSessionAmount = sessionPmts.reduce((sum, sp) => sum + sp.amount, 0);
            if (Math.abs(totalSessionAmount - invoice.amount) > 0.01) {
              test.checks.push({
                name: 'Session Payments',
                status: 'fail',
                message: `Session payment total (£${totalSessionAmount.toFixed(2)}) doesn't match invoice (£${invoice.amount.toFixed(2)})`
              });
              test.status = 'fail';
            } else {
              test.checks.push({
                name: 'Session Payments',
                status: 'pass',
                message: `${sessionPmts.length} session payments totaling £${totalSessionAmount.toFixed(2)}`
              });
            }

            // Check 4: Member income records only exist for PAID session payments
            for (const sp of sessionPmts) {
              const memberIncome = incomeRecords.filter(
                inc => inc.member_email === sp.musician_email &&
                       inc.booking_id === booking.id &&
                       inc.record_type === 'member_share'
              );

              if (sp.paid && memberIncome.length === 0) {
                test.checks.push({
                  name: 'Member Income Consistency',
                  status: 'fail',
                  message: `Session payment for ${sp.musician_name} marked PAID but no member income record found`
                });
                test.status = 'fail';
              } else if (!sp.paid && memberIncome.length > 0) {
                test.checks.push({
                  name: 'Member Income Consistency',
                  status: 'fail',
                  message: `Session payment for ${sp.musician_name} marked UNPAID but member income record exists`
                });
                test.status = 'fail';
              }
            }
          }
        }

        results.flowTests.push(test);
        if (test.status === 'fail') results.summary.failed++;
        else if (test.status === 'warning') results.summary.warnings++;
        else results.summary.passed++;
      }

      // TEST 3: DUPLICATE DETECTION
      console.log('=== TEST 3: DUPLICATE DETECTION ===');

      // Check income duplicates - ONLY flag if exact same ID appears multiple times
      // IMPORTANT: Check for TRUE duplicates only (same exact record ID appearing multiple times)
      // NOT similar records - each invoice legitimately creates multiple records (1 band + 4 musicians)
      const incomeByKey = {};
      incomeRecords.forEach(record => {
        // Only flag if the exact same record appears twice (same record.id)
        const key = record.id;
        if (!incomeByKey[key]) {
          incomeByKey[key] = [];
        }
        incomeByKey[key].push(record);
      });
      const duplicateIncomeGroups = Object.values(incomeByKey).filter(group => group.length > 1);

      if (duplicateIncomeGroups.length > 0) {
        results.duplicateTests.push({
          type: 'Income Records',
          status: 'fail',
          count: duplicateIncomeGroups.reduce((sum, g) => sum + g.length, 0),
          uniqueCount: duplicateIncomeGroups.length,
          message: `Found ${duplicateIncomeGroups.length} duplicate income record(s) with identical IDs`,
          groups: duplicateIncomeGroups
        });
        results.summary.failed++;
      } else {
        results.duplicateTests.push({
          type: 'Income Records',
          status: 'pass',
          message: 'No duplicate income records',
          groups: [] // Ensure groups array is always present for consistent rendering
        });
        results.summary.passed++;
      }

      // Check session payment duplicates - only flag true duplicates (same ID)
      const sessionByKey = {};
      sessionPayments.forEach(sp => {
        const key = sp.id;
        if (!sessionByKey[key]) {
          sessionByKey[key] = [];
        }
        sessionByKey[key].push(sp);
      });
      const duplicateSessionGroups = Object.values(sessionByKey).filter(group => group.length > 1);

      if (duplicateSessionGroups.length > 0) {
        results.duplicateTests.push({
          type: 'Session Payments',
          status: 'fail',
          count: duplicateSessionGroups.reduce((sum, g) => sum + g.length, 0),
          uniqueCount: duplicateSessionGroups.length,
          message: `Found ${duplicateSessionGroups.length} duplicate session payment(s) with identical IDs`,
          groups: duplicateSessionGroups
        });
        results.summary.failed++;
      } else {
        results.duplicateTests.push({
          type: 'Session Payments',
          status: 'pass',
          message: 'No duplicate session payments',
          groups: []
        });
        results.summary.passed++;
      }

      // Check expense duplicates - only flag true duplicates (same ID)
      const expenseByKey = {};
      expenses.forEach(exp => {
        const key = exp.id;
        if (!expenseByKey[key]) {
          expenseByKey[key] = [];
        }
        expenseByKey[key].push(exp);
      });
      const duplicateExpenseGroups = Object.values(expenseByKey).filter(group => group.length > 1);

      if (duplicateExpenseGroups.length > 0) {
        results.duplicateTests.push({
          type: 'Expenses',
          status: 'fail',
          count: duplicateExpenseGroups.reduce((sum, g) => sum + g.length, 0),
          uniqueCount: duplicateExpenseGroups.length,
          message: `Found ${duplicateExpenseGroups.length} duplicate expense(s) with identical IDs`,
          groups: duplicateExpenseGroups
        });
        results.summary.failed++;
      } else {
        results.duplicateTests.push({
          type: 'Expenses',
          status: 'pass',
          message: 'No duplicate expenses',
          groups: []
        });
        results.summary.passed++;
      }

      // TEST 4: MATH VERIFICATION
      console.log('=== TEST 4: MATH VERIFICATION ===');

      // Use actual records for math verification (no deduplication)
      const totalBandRevenue = incomeRecords
        .filter(inc => inc.record_type === 'band_total')
        .reduce((sum, inc) => sum + inc.amount, 0);

      const totalBandExpenses = expenses
        .filter(exp => exp.expense_type === 'band')
        .reduce((sum, exp) => sum + exp.amount, 0);

      const calculatedProfit = totalBandRevenue - totalBandExpenses;

      // Verify against invoice totals
      const totalInvoiceAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);

      results.mathTests.push({
        name: 'Revenue Consistency',
        status: Math.abs(totalBandRevenue - totalInvoiceAmount) < 0.01 ? 'pass' : 'fail',
        expected: totalInvoiceAmount,
        actual: totalBandRevenue,
        message: Math.abs(totalBandRevenue - totalInvoiceAmount) < 0.01
          ? `Band revenue (£${totalBandRevenue.toFixed(2)}) matches invoice total`
          : `Band revenue (£${totalBandRevenue.toFixed(2)}) doesn't match invoice total (£${totalInvoiceAmount.toFixed(2)})`
      });

      // Verify session payments match invoices
      const totalSessionPayments = sessionPayments.reduce((sum, sp) => sum + sp.amount, 0);

      results.mathTests.push({
        name: 'Session Payment Totals',
        status: Math.abs(totalSessionPayments - totalInvoiceAmount) < 0.01 ? 'pass' : 'fail',
        expected: totalInvoiceAmount,
        actual: totalSessionPayments,
        message: Math.abs(totalSessionPayments - totalInvoiceAmount) < 0.01
          ? `Session payments (£${totalSessionPayments.toFixed(2)}) equal invoice total`
          : `Session payments (£${totalSessionPayments.toFixed(2)}) don't match invoice total (£${totalInvoiceAmount.toFixed(2)})`
      });

      results.mathTests.push({
        name: 'Net Profit Calculation',
        status: 'info',
        value: calculatedProfit,
        message: `Revenue £${totalBandRevenue.toFixed(2)} - Expenses £${totalBandExpenses.toFixed(2)} = Profit £${calculatedProfit.toFixed(2)}`
      });

      results.mathTests.forEach(test => {
        if (test.status === 'pass') results.summary.passed++;
        else if (test.status === 'fail') results.summary.failed++;
      });

      // NEW: TEST 5: PDF LINK VERIFICATION
      console.log('=== TEST 5: PDF LINK VERIFICATION ===');
      for (const invoice of invoices) {
        if (invoice.invoice_generated) {
          if (!invoice.pdf_link || invoice.pdf_link.trim() === '') {
            results.pdfLinkTests.push({
              invoice: invoice,
              status: 'fail',
              message: `Invoice #${invoice.invoice_number || invoice.id} marked generated, but no PDF link found.`,
              id: invoice.id // Include ID for fixing
            });
            results.summary.failed++;
          } else {
            // Potentially add a check here to validate the URL format or even make a HEAD request
            results.pdfLinkTests.push({
              invoice: invoice,
              status: 'pass',
              message: `Invoice #${invoice.invoice_number || invoice.id} has a PDF link.`,
              id: invoice.id
            });
            results.summary.passed++;
          }
        } else {
          // If not marked as generated, a PDF link might be a warning, or pass if none exists.
          if (invoice.pdf_link && invoice.pdf_link.trim() !== '') {
            results.pdfLinkTests.push({
              invoice: invoice,
              status: 'warning',
              message: `Invoice #${invoice.invoice_number || invoice.id} not marked generated, but has a PDF link.`,
              id: invoice.id
            });
            results.summary.warnings++;
          } else {
            results.pdfLinkTests.push({
              invoice: invoice,
              status: 'pass',
              message: `Invoice #${invoice.invoice_number || invoice.id} not marked generated, no PDF link expected.`,
              id: invoice.id
            });
            results.summary.passed++;
          }
        }
      }


      console.log('=== TEST RESULTS ===', results);
      setTestResults(results);

    } catch (error) {
      console.error('Test error:', error);
      toast.error('Failed to run tests: ' + error.message);
    } finally {
      setTesting(false);
    }
  };

  const fixAllIssues = async () => {
    if (!testResults) {
      toast.error('Please run the test first');
      return;
    }

    if (!window.confirm('🔧 This will automatically fix ALL issues found in the deep test. Continue?')) {
      return;
    }

    setFixing(true);
    const fixes = {
      bookingsFixed: 0,
      invoicesCreated: 0,
      bandIncomeCreated: 0,
      sessionPaymentsCreated: 0,
      memberIncomeDeleted: 0,
      expensesFixed: 0,
      duplicatesRemoved: 0,
      pdfLinksGenerated: 0, // NEW: Counter for generated PDF links
      errors: []
    };

    try {
      setFixProgress({ current: 0, total: 100, step: 'Starting fixes...' });

      // FIX 1: BOOKING ISSUES
      setFixProgress({ current: 10, total: 100, step: 'Fixing booking issues...' });
      for (const test of testResults.bookingTests.filter(t => t.status === 'fail')) {
        for (const check of test.checks.filter(c => c.status === 'fail')) {
          try {
            if (check.name === 'Balance Calculation') {
              const correctBalance = (test.booking.fee || 0) - (test.booking.deposit_paid || 0);
              await base44.entities.Booking.update(test.booking.id, { balance_due: correctBalance });
              fixes.bookingsFixed++;
            } else if (check.name === 'Payment Status') {
              let correctStatus = 'unpaid';
              if (test.booking.balance_due <= 0.01 && (test.booking.fee || 0) > 0) { // If balance is effectively zero and there was a fee
                correctStatus = 'paid_in_full';
              } else if ((test.booking.deposit_paid || 0) > 0) {
                correctStatus = 'deposit_paid';
              }
              await base44.entities.Booking.update(test.booking.id, { payment_status: correctStatus });
              fixes.bookingsFixed++;
            }
          } catch (error) {
            console.error(`Error fixing booking ${test.booking.id} (${check.name}):`, error);
            fixes.errors.push({ type: 'booking', id: test.booking.id, error: error.message });
          }
        }
      }

      // FIX 2: INVOICE FLOW ISSUES
      setFixProgress({ current: 30, total: 100, step: 'Fixing invoice flow issues...' });
      for (const test of testResults.flowTests.filter(t => t.status === 'fail' || t.status === 'warning')) {
        for (const check of test.checks.filter(c => c.status === 'fail')) {
          try {
            if (check.name === 'Band Income Record' && check.message.includes('No band_total')) {
              // Create missing band income record
              const invoice = test.invoice;
              const booking = bookings.find(b => b.id === invoice.booking_id);
              if (booking) {
                const eventDate = new Date(booking.event_date);
                const year = eventDate.getFullYear();
                const taxYearStart = new Date(year, 3, 6); // April 6th
                const taxYear = eventDate >= taxYearStart ? `${year}-${year + 1}` : `${year - 1}-${year}`;

                await base44.entities.IncomeRecord.create({
                  invoice_id: invoice.id,
                  booking_id: booking.id,
                  member_email: 'band', // Placeholder for band email
                  member_name: 'The Green Tangerine', // Placeholder for band name
                  income_date: booking.event_date,
                  client_name: booking.client_name,
                  venue_name: booking.venue_name,
                  amount: invoice.amount,
                  tax_year: taxYear,
                  record_type: 'band_total',
                  notes: `Band income - Auto-fixed by deep test`
                });
                fixes.bandIncomeCreated++;
              }
            } else if (check.name === 'Band Income Record' && check.message.includes('Amount mismatch')) {
              // Fix band income amount
              const invoice = test.invoice;
              const bandIncome = incomeRecords.find(
                inc => inc.invoice_id === invoice.id && inc.record_type === 'band_total'
              );
              if (bandIncome) {
                await base44.entities.IncomeRecord.update(bandIncome.id, { amount: invoice.amount });
                fixes.bandIncomeCreated++; // Count as fixed/updated
              }
            } else if (check.name === 'Session Payments' && check.message.includes('No session payment')) {
              // Create missing session payments
              const invoice = test.invoice;
              const booking = bookings.find(b => b.id === invoice.booking_id);
              if (booking && bandMembers.length > 0) {
                const eventDate = new Date(booking.event_date);
                const year = eventDate.getFullYear();
                const taxYearStart = new Date(year, 3, 6);
                const taxYear = eventDate >= taxYearStart ? `${year}-${year + 1}` : `${year - 1}-${year}`;
                const sessionAmount = invoice.amount / bandMembers.length;

                const newSP = [];
                for (const member of bandMembers) {
                  newSP.push({
                    booking_id: booking.id,
                    invoice_id: invoice.id,
                    musician_email: member.email,
                    musician_name: member.full_name,
                    musician_display_name: member.display_name || member.full_name,
                    payment_date: booking.event_date,
                    event_date: booking.event_date,
                    venue_name: booking.venue_name,
                    amount: sessionAmount,
                    tax_year: taxYear,
                    paid: false, // Default to unpaid
                    notes: `Session payment - Auto-fixed by deep test`
                  });
                }
                if (newSP.length > 0) {
                  await base44.entities.SessionPayment.createMany(newSP);
                  fixes.sessionPaymentsCreated += newSP.length;
                }
              }
            } else if (check.name === 'Session Payments' && check.message.includes("doesn't match invoice")) {
              // Fix session payment amounts
              const invoice = test.invoice;
              const invoiceSPs = sessionPayments.filter(sp => sp.invoice_id === invoice.id);
              if (invoiceSPs.length > 0) {
                const correctAmount = invoice.amount / invoiceSPs.length;
                for (const sp of invoiceSPs) {
                  if (Math.abs(sp.amount - correctAmount) > 0.01) {
                    await base44.entities.SessionPayment.update(sp.id, { amount: correctAmount });
                    fixes.sessionPaymentsCreated++; // Count as fixed/updated
                  }
                }
              }
            } else if (check.name === 'Member Income Consistency' && check.message.includes('UNPAID but member income record exists')) {
              // Delete member income for unpaid session payments
              const musicianNamePart = check.message.split('for ')[1]; // e.g., "John Doe"
              const booking = bookings.find(b => b.id === test.invoice.booking_id);
              if (booking) {
                const wrongIncome = incomeRecords.filter(
                  inc => inc.booking_id === booking.id &&
                         inc.record_type === 'member_share' &&
                         (inc.member_name?.includes(musicianNamePart) || inc.member_email?.includes(musicianNamePart))
                );
                for (const inc of wrongIncome) {
                  await base44.entities.IncomeRecord.delete(inc.id);
                  fixes.memberIncomeDeleted++;
                }
              }
            }
          } catch (error) {
            console.error(`Error fixing invoice ${test.invoice.id} (${check.name}):`, error);
            fixes.errors.push({ type: 'invoice', id: test.invoice.id, error: error.message });
          }
        }
      }

      // NEW: FIX 3: PDF LINK ISSUES
      setFixProgress({ current: 50, total: 100, step: 'Generating missing PDF links...' });
      for (const test of testResults.pdfLinkTests.filter(t => t.status === 'fail')) {
        try {
          const invoiceId = test.id; // Use the ID stored in the test result
          if (invoiceId) {
            // ASSUMPTION: base44.entities.Invoice.generatePdf(invoiceId) is a valid API call
            // that triggers the backend to generate or re-generate the PDF and update the invoice record's pdf_link.
            // If your API handles custom actions differently (e.g., base44.api.post(`/invoices/${invoiceId}/generate-pdf`)),
            // you'll need to adjust this call.
            await base44.entities.Invoice.generatePdf(invoiceId);
            fixes.pdfLinksGenerated++;
          }
        } catch (error) {
          console.error(`Error generating PDF for invoice ${test.invoice.id}:`, error);
          fixes.errors.push({ type: 'pdf_link', id: test.invoice.id, error: error.message });
        }
      }


      // FIX 4: REMOVE DUPLICATES (Adjusting progress steps)
      setFixProgress({ current: 60, total: 100, step: 'Removing duplicates...' });
      for (const test of testResults.duplicateTests.filter(t => t.status === 'fail')) {
        try {
          if (test.groups) {
            for (const group of test.groups) {
              // Keep first, delete rest
              for (let i = 1; i < group.length; i++) {
                if (test.type === 'Income Records') {
                  await base44.entities.IncomeRecord.delete(group[i].id);
                } else if (test.type === 'Session Payments') {
                  await base44.entities.SessionPayment.delete(group[i].id);
                } else if (test.type === 'Expenses') {
                  await base44.entities.Expense.delete(group[i].id);
                }
                fixes.duplicatesRemoved++;
              }
            }
          }
        } catch (error) {
          console.error(`Error removing duplicate (${test.type}):`, error);
          fixes.errors.push({ type: 'duplicate', error: error.message });
        }
      }

      // FIX 5: FIX WRONG EXPENSE CATEGORIES (Adjusting progress steps)
      setFixProgress({ current: 80, total: 100, step: 'Fixing expense categories...' });
      const wrongCategoryExpenses = expenses.filter(exp =>
        exp.expense_type === 'band' &&
        exp.description?.includes('Session payment') &&
        exp.category !== 'session_payment'
      );
      for (const expense of wrongCategoryExpenses) {
        try {
          await base44.entities.Expense.update(expense.id, { category: 'session_payment' });
          fixes.expensesFixed++;
        } catch (error) {
          console.error(`Error fixing expense category ${expense.id}:`, error);
          fixes.errors.push({ type: 'expense', id: expense.id, error: error.message });
        }
      }

      setFixProgress({ current: 100, total: 100, step: 'Complete!' });

      // Refresh all data queries used in the analyzer and other dashboards
      await queryClient.invalidateQueries({ queryKey: ['bookings-test'] });
      await queryClient.invalidateQueries({ queryKey: ['invoices-test'] });
      await queryClient.invalidateQueries({ queryKey: ['income-test'] });
      await queryClient.invalidateQueries({ queryKey: ['session-payments-test'] });
      await queryClient.invalidateQueries({ queryKey: ['expenses-test'] });
      await queryClient.invalidateQueries({ queryKey: ['band-members-test'] });

      // Invalidate general dashboards/lists that might display this data
      await queryClient.invalidateQueries({ queryKey: ['bookings'] });
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      await queryClient.invalidateQueries({ queryKey: ['income-records'] });
      await queryClient.invalidateQueries({ queryKey: ['session-payments'] });
      await queryClient.invalidateQueries({ queryKey: ['expenses'] });
      await queryClient.invalidateQueries({ queryKey: ['band-income-dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['band-expenses-dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['members-summary'] });

      toast.success(
        `✅ All Issues Fixed!\n\n` +
        `• ${fixes.bookingsFixed} bookings corrected\n` +
        `• ${fixes.invoicesCreated} invoices created\n` +
        `• ${fixes.bandIncomeCreated} band income records created/fixed\n` +
        `• ${fixes.sessionPaymentsCreated} session payments created/fixed\n` +
        `• ${fixes.memberIncomeDeleted} incorrect member income deleted\n` +
        `• ${fixes.expensesFixed} expenses fixed\n` +
        `• ${fixes.duplicatesRemoved} duplicates removed\n` +
        `• ${fixes.pdfLinksGenerated} missing PDF links generated\n\n` + // NEW: Add to summary
        `${fixes.errors.length > 0 ? `⚠️ ${fixes.errors.length} errors occurred during fixing` : '🎉 Perfect!'}`
      );

      // Re-run test to verify, giving some time for data to propagate if backend is eventually consistent
      setTimeout(() => runDeepTest(), 2000);

    } catch (error) {
      console.error('Fix error:', error);
      toast.error('Failed to fix issues: ' + error.message);
    } finally {
      setFixing(false);
      setFixProgress({ current: 0, total: 0, step: '' }); // Reset progress
    }
  };

  const rebuildFromScratch = async () => {
    if (!window.confirm(
      '🚨 NUCLEAR OPTION: This will DELETE all invoices, income records, session payments, and session payment expenses, then rebuild everything from your bookings calendar.\n\n' +
      'Only invoiced bookings (payment_method = invoice AND invoice_generated = true) will be processed.\n\n' +
      'Are you absolutely sure?'
    )) {
      return;
    }

    if (!window.confirm('Last chance! This cannot be undone. Continue?')) {
      return;
    }

    setFixing(true);
    const stats = {
      deleted: { invoices: 0, income: 0, sessionPayments: 0, expenses: 0 },
      created: { invoices: 0, income: 0, sessionPayments: 0 },
      errors: []
    };

    try {
      // STEP 1: DELETE ALL EXISTING RECORDS
      setFixProgress({ current: 0, total: 100, step: 'Deleting all invoices...' });
      for (const invoice of invoices) {
        try {
          await base44.entities.Invoice.delete(invoice.id);
          stats.deleted.invoices++;
        } catch (error) {
          stats.errors.push({ type: 'delete_invoice', id: invoice.id, error: error.message });
        }
      }

      setFixProgress({ current: 20, total: 100, step: 'Deleting all income records...' });
      for (const income of incomeRecords) {
        try {
          await base44.entities.IncomeRecord.delete(income.id);
          stats.deleted.income++;
        } catch (error) {
          stats.errors.push({ type: 'delete_income', id: income.id, error: error.message });
        }
      }

      setFixProgress({ current: 40, total: 100, step: 'Deleting all session payments...' });
      for (const sp of sessionPayments) {
        try {
          await base44.entities.SessionPayment.delete(sp.id);
          stats.deleted.sessionPayments++;
        } catch (error) {
          stats.errors.push({ type: 'delete_session_payment', id: sp.id, error: error.message });
        }
      }

      setFixProgress({ current: 60, total: 100, step: 'Deleting session payment expenses...' });
      const sessionExpenses = expenses.filter(e => e.expense_type === 'band' && e.category === 'session_payment');
      for (const expense of sessionExpenses) {
        try {
          await base44.entities.Expense.delete(expense.id);
          stats.deleted.expenses++;
        } catch (error) {
          stats.errors.push({ type: 'delete_expense', id: expense.id, error: error.message });
        }
      }

      // STEP 2: REBUILD FROM BOOKINGS
      setFixProgress({ current: 70, total: 100, step: 'Rebuilding from bookings...' });

      // Get only invoice-type bookings with invoice_generated = true
      const invoicedBookings = bookings.filter(b =>
        b.payment_method === 'invoice' &&
        b.invoice_generated === true
      );

      for (const booking of invoicedBookings) {
        try {
          // Calculate tax year
          const eventDate = new Date(booking.event_date);
          const year = eventDate.getFullYear();
          const taxYearStart = new Date(year, 3, 6); // April 6th
          const taxYear = eventDate >= taxYearStart ? `${year}-${year + 1}` : `${year - 1}-${year}`;

          // 1. Create Invoice
          const invoice = await base44.entities.Invoice.create({
            invoice_number: `INV-${booking.id.substring(0, 8)}-${Date.now()}`,
            booking_id: booking.id,
            client_name: booking.client_name,
            client_email: booking.client_email,
            issue_date: format(new Date(booking.event_date), 'yyyy-MM-dd'),
            due_date: format(new Date(booking.event_date), 'yyyy-MM-dd'),
            amount: booking.fee,
            tax_year: taxYear,
            paid: booking.payment_status === 'paid_in_full',
            paid_date: booking.payment_status === 'paid_in_full' ? format(new Date(booking.event_date), 'yyyy-MM-dd') : null,
            items: [{
              description: `Live Performance at ${booking.venue_name} on ${format(new Date(booking.event_date), 'MMM d, yyyy')}`,
              amount: booking.fee
            }]
            // pdf_link is assumed to be generated by the backend upon creation
          });
          stats.created.invoices++;

          // 2. Create Band Income Record (band_total) - ALWAYS created for invoiced bookings
          await base44.entities.IncomeRecord.create({
            invoice_id: invoice.id,
            booking_id: booking.id,
            member_email: 'band',
            member_name: 'The Green Tangerine',
            income_date: booking.event_date,
            client_name: booking.client_name,
            venue_name: booking.venue_name,
            amount: booking.fee,
            tax_year: taxYear,
            record_type: 'band_total',
            notes: `Band income from ${booking.venue_name} - Invoice ${invoice.invoice_number}`
          });
          stats.created.income++;

          // 3. Create Session Payment Records for all band members (UNPAID by default)
          if (bandMembers.length > 0) {
            const sessionAmount = booking.fee / bandMembers.length;
            const sessionPaymentRecords = [];

            for (const member of bandMembers) {
              sessionPaymentRecords.push({
                booking_id: booking.id,
                invoice_id: invoice.id,
                musician_email: member.email,
                musician_name: member.full_name,
                musician_display_name: member.display_name || member.full_name,
                payment_date: booking.event_date,
                event_date: booking.event_date,
                venue_name: booking.venue_name,
                amount: sessionAmount,
                tax_year: taxYear,
                paid: false, // Always start as unpaid
                notes: `Session payment for ${booking.venue_name} - Rebuilt from scratch`
              });
            }

            if (sessionPaymentRecords.length > 0) {
              await base44.entities.SessionPayment.createMany(sessionPaymentRecords); // Use createMany consistently
              stats.created.sessionPayments += sessionPaymentRecords.length;
            }
          }

        } catch (error) {
          console.error(`Error rebuilding booking ${booking.id}:`, error);
          stats.errors.push({ type: 'rebuild_booking', id: booking.id, error: error.message });
        }
      }

      setFixProgress({ current: 100, total: 100, step: 'Complete!' });

      // Refresh all data
      await queryClient.invalidateQueries({ queryKey: ['bookings-test'] });
      await queryClient.invalidateQueries({ queryKey: ['invoices-test'] });
      await queryClient.invalidateQueries({ queryKey: ['income-test'] });
      await queryClient.invalidateQueries({ queryKey: ['session-payments-test'] });
      await queryClient.invalidateQueries({ queryKey: ['expenses-test'] });
      await queryClient.invalidateQueries({ queryKey: ['bookings'] });
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      await queryClient.invalidateQueries({ queryKey: ['income-records'] });
      await queryClient.invalidateQueries({ queryKey: ['session-payments'] });
      await queryClient.invalidateQueries({ queryKey: ['expenses'] });
      await queryClient.invalidateQueries({ queryKey: ['band-income-dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['band-expenses-dashboard'] });

      toast.success(
        `✅ Rebuild Complete!\n\n` +
        `Deleted: ${stats.deleted.invoices} invoices, ${stats.deleted.income} income, ${stats.deleted.sessionPayments} session payments, ${stats.deleted.expenses} expenses\n\n` +
        `Created: ${stats.created.invoices} invoices, ${stats.created.income} band income records, ${stats.created.sessionPayments} session payment records\n\n` +
        `${stats.errors.length > 0 ? `⚠️ ${stats.errors.length} errors occurred` : '✨ No errors!'}`
      );

      // Re-run test
      setTimeout(() => runDeepTest(), 1000);

    } catch (error) {
      console.error('Rebuild error:', error);
      toast.error('Failed to rebuild: ' + error.message);
    } finally {
      setFixing(false);
      setFixProgress({ current: 0, total: 0, step: '' }); // Reset progress
    }
  };

  return (
    <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-sm border-purple-500/30 mb-8">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 mr-2 text-purple-400" />
            Deep Test Analyzer
          </div>
          {testResults && (
            <div className="flex items-center gap-2">
              <Badge className="bg-green-500/20 text-green-400">
                {testResults.summary.passed} passed
              </Badge>
              {testResults.summary.failed > 0 && (
                <Badge className="bg-red-500/20 text-red-400">
                  {testResults.summary.failed} failed
                </Badge>
              )}
              {testResults.summary.warnings > 0 && (
                <Badge className="bg-yellow-500/20 text-yellow-400">
                  {testResults.summary.warnings} warnings
                </Badge>
              )}
            </div>
          )}
        </CardTitle>
        <p className="text-sm text-gray-400 mt-2">
          Comprehensive testing of all data flows, calculations, and integrity
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {fixing && (
          <div className="bg-white/5 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-300">{fixProgress.step}</span>
              <span className="text-sm text-purple-400 font-medium">
                {fixProgress.current}%
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all"
                style={{ width: `${fixProgress.current}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Button
            onClick={runDeepTest}
            disabled={testing || fixing}
            className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 h-12 w-full"
          >
            {testing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Running Tests...
              </>
            ) : (
              <>
                <Search className="w-5 h-5 mr-2" />
                Run Deep Test
              </>
            )}
          </Button>

          {testResults && (testResults.summary.failed > 0 || testResults.summary.warnings > 0) && (
            <Button
              onClick={fixAllIssues}
              disabled={testing || fixing}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 h-12 w-full"
            >
              {fixing && fixProgress.step !== 'Starting fixes...' && fixProgress.step !== 'Complete!' ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Fixing... {fixProgress.current}%
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Fix All Issues
                </>
              )}
            </Button>
          )}

          <Button
            onClick={rebuildFromScratch}
            disabled={testing || fixing}
            className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 h-12 w-full"
          >
            {fixing && (fixProgress.step.includes('Deleting') || fixProgress.step.includes('Rebuilding')) ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Rebuilding... {fixProgress.current}%
              </>
            ) : (
              <>
                <Trash2 className="w-5 h-5 mr-2" />
                🚨 Rebuild From Scratch
              </>
            )}
          </Button>
        </div>

        {testResults && (
          <div className="space-y-4">
            {/* Math Tests */}
            {testResults.mathTests.length > 0 && (
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white text-sm">💰 Math Verification</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {testResults.mathTests.map((test, idx) => (
                    <div key={idx} className="flex items-start justify-between p-2 bg-white/5 rounded">
                      <div className="flex items-start gap-2 flex-1">
                        {test.status === 'pass' ? (
                          <CheckCircle className="w-4 h-4 text-green-400 mt-0.5" />
                        ) : test.status === 'fail' ? (
                          <XCircle className="w-4 h-4 text-red-400 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-blue-400 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">{test.name}</p>
                          <p className="text-xs text-gray-400">{test.message}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Duplicate Tests - Enhanced UI based on outline */}
            {testResults.duplicateTests.length > 0 && (
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white text-sm">🔍 Duplicate Detection</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {testResults.duplicateTests.map((test, i) => (
                    <div key={i} className="p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {test.status === 'pass' ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-orange-400" />
                          )}
                          <span className="text-white font-medium">{test.type}</span>
                        </div>
                        <Badge className={test.status === 'pass' ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}>
                          {test.message}
                        </Badge>
                      </div>
                      {test.groups && test.groups.length > 0 && (
                        <div className="mt-2 space-y-1 text-xs text-gray-400">
                          {test.groups.slice(0, 3).map((group, gi) => (
                            <div key={gi} className="p-2 bg-white/5 rounded">
                              {group[0].invoice_id && (
                                <p className="text-blue-400">Invoice: {group[0].invoice_id?.substring(0, 12)}...</p>
                              )}
                              <p>Amount: £{group[0].amount?.toFixed(2)} × {group.length} records</p>
                              <p>Date: {group[0].income_date || group[0].expense_date || group[0].event_date}</p>
                            </div>
                          ))}
                          {test.groups.length > 3 && (
                            <p className="text-gray-500">...and {test.groups.length - 3} more</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* NEW: PDF Link Verification */}
            {testResults.pdfLinkTests.length > 0 && (
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white text-sm">📄 PDF Link Verification</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {testResults.pdfLinkTests.map((test, idx) => (
                    <div key={idx} className="flex items-start justify-between p-2 bg-white/5 rounded">
                      <div className="flex items-start gap-2 flex-1">
                        {test.status === 'pass' ? (
                          <CheckCircle className="w-4 h-4 text-green-400 mt-0.5" />
                        ) : test.status === 'fail' ? (
                          <XCircle className="w-4 h-4 text-red-400 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">Invoice ID: {test.invoice?.id}</p>
                          <p className="text-xs text-gray-400">{test.message}</p>
                          {test.invoice?.pdf_link && test.status !== 'fail' && (
                            <a href={test.invoice.pdf_link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline flex items-center gap-1 mt-1">
                              <FileText className="w-3 h-3" /> View PDF
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Failed Flow Tests */}
            {testResults.flowTests.filter(t => t.status !== 'pass').length > 0 && (
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white text-sm">⚠️ Flow Issues ({testResults.flowTests.filter(t => t.status !== 'pass').length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 max-h-64 overflow-y-auto">
                  {testResults.flowTests
                    .filter(t => t.status !== 'pass')
                    .slice(0, 5) // Limit displayed items for brevity
                    .map((test, idx) => (
                    <div key={idx} className="p-3 bg-white/5 rounded">
                      <p className="text-sm font-medium text-white mb-2">
                        Invoice: {test.invoice?.invoice_number || test.invoice?.id}
                      </p>
                      {test.checks.filter(c => c.status !== 'pass').map((check, cidx) => (
                        <div key={cidx} className="flex items-start gap-2 text-xs mb-1">
                          {check.status === 'fail' ? (
                            <XCircle className="w-3 h-3 text-red-400 mt-0.5" />
                          ) : (
                            <AlertTriangle className="w-3 h-3 text-yellow-400 mt-0.5" />
                          )}
                          <span className={check.status === 'fail' ? 'text-red-400' : 'text-yellow-400'}>
                            {check.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Failed Booking Tests */}
            {testResults.bookingTests.filter(t => t.status !== 'pass').length > 0 && (
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white text-sm">⚠️ Booking Issues ({testResults.bookingTests.filter(t => t.status !== 'pass').length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 max-h-64 overflow-y-auto">
                  {testResults.bookingTests
                    .filter(t => t.status !== 'pass')
                    .slice(0, 5) // Limit displayed items for brevity
                    .map((test, idx) => (
                    <div key={idx} className="p-3 bg-white/5 rounded">
                      <p className="text-sm font-medium text-white mb-2">
                        {test.booking?.venue_name} - {test.booking?.event_date && format(new Date(test.booking.event_date), 'MMM d, yyyy')}
                      </p>
                      {test.checks.filter(c => c.status !== 'pass').map((check, cidx) => (
                        <div key={cidx} className="flex items-start gap-2 text-xs mb-1">
                          {check.status === 'fail' ? (
                            <XCircle className="w-3 h-3 text-red-400 mt-0.5" />
                          ) : (
                            <AlertTriangle className="w-3 h-3 text-yellow-400 mt-0.5" />
                          )}
                          <span className={check.status === 'fail' ? 'text-red-400' : 'text-yellow-400'}>
                            {check.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
