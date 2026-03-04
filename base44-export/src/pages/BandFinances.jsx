
import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PoundSterling, TrendingUp, TrendingDown, Building2, AlertCircle, Calendar } from "lucide-react";
import SessionPaymentTracker from "../components/expenses/SessionPaymentTracker";

export default function BandFinances() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  
  // Get current tax year
  const getCurrentTaxYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const taxYearStart = new Date(currentYear, 3, 6); // April 6th
    return now >= taxYearStart ? `${currentYear}-${currentYear + 1}` : `${currentYear - 1}-${currentYear}`;
  };

  const [selectedTaxYear, setSelectedTaxYear] = useState(getCurrentTaxYear());

  // Generate tax year options (current + last 3 years)
  const generateTaxYears = () => {
    const years = [];
    const currentYear = new Date().getFullYear();
    for (let i = 0; i < 4; i++) {
      const year = currentYear - i;
      years.push(`${year}-${year + 1}`);
    }
    return years;
  };

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (error) {
        setUser(null); // User is null if not logged in or an error occurs, but the app remains public.
      }
    };
    loadUser();
  }, []); // Removed `navigate` from dependencies as it's no longer used for redirection.

  // 1. REVENUE: Money received FROM CLIENTS
  const { data: bandIncomeRecords = [] } = useQuery({
    queryKey: ['band-income-finances', selectedTaxYear],
    queryFn: async () => {
      const records = await base44.entities.IncomeRecord.list('-income_date');
      return records.filter(r => r.record_type === 'band_total' && r.tax_year === selectedTaxYear);
    },
    initialData: [],
  });

  // 2. EXPENSES: Money paid OUT by band (session payments + other costs)
  const { data: bandExpenses = [] } = useQuery({
    queryKey: ['band-expenses-finances', selectedTaxYear],
    queryFn: async () => {
      const allExpenses = await base44.entities.Expense.list('-expense_date');
      return allExpenses.filter(e => 
        e.expense_type === 'band' && 
        e.tax_year === selectedTaxYear
      );
    },
    initialData: [],
  });

  // Query invoices to get PDF URLs - ALREADY EXISTS, just verify it's there
  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices-for-links'],
    queryFn: () => base44.entities.Invoice.list(),
    initialData: [],
  });

  // 3. UNPAID SESSION PAYMENTS: Money we OWE but haven't paid yet (for selected tax year)
  const { data: unpaidSessionPayments = [] } = useQuery({
    queryKey: ['unpaid-session-payments-finances', selectedTaxYear],
    queryFn: async () => {
      const all = await base44.entities.SessionPayment.list();
      return all.filter(sp => !sp.paid && sp.tax_year === selectedTaxYear);
    },
    initialData: [],
  });

  // CALCULATIONS (for SELECTED TAX YEAR ONLY)
  // Revenue = Money from clients
  const totalRevenue = bandIncomeRecords.reduce((sum, record) => sum + record.amount, 0);
  
  // Expenses = Money paid out (includes session payments that were marked as PAID)
  const totalExpenses = bandExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  
  // Owed = Session payments not yet paid
  const totalOwedToMusicians = unpaidSessionPayments.reduce((sum, sp) => sum + sp.amount, 0);
  
  // CRITICAL: Band net profit calculation
  // Revenue = What band received from clients
  // Expenses = What band paid out (session payments + other band costs)
  // Net Profit = Revenue - All Expenses - Outstanding Payments
  // Should be ~£0 if all musicians have been paid
  // Will be positive if some payments are still pending
  const netProfit = totalRevenue - totalExpenses - totalOwedToMusicians;

  // The component no longer waits for user authentication to render, making it public.
  // The `user` state might still hold user data if available, but it doesn't block rendering.

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Band Finances</h1>
          <p className="text-gray-400">Track band income, expenses and session musician payments</p>
        </div>

        {/* Tax Year Filter */}
        <Card className="bg-white/5 backdrop-blur-sm border-blue-500/20 mb-6">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <Calendar className="w-5 h-5 text-blue-400" />
              <div className="flex-1">
                <Label className="text-gray-300 text-sm">Tax Year</Label>
                <Select value={selectedTaxYear} onValueChange={setSelectedTaxYear}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {generateTaxYears().map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-gray-400">
                <p>Showing data for tax year {selectedTaxYear}</p>
                <p className="text-xs">(Apr 6 - Apr 5)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Box */}
        <Card className="bg-blue-500/10 border-blue-500/30 mb-6">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-300">
                <p className="font-medium text-blue-400 mb-1">How Band Finances Work:</p>
                <ul className="space-y-1 text-xs">
                  <li>• <strong>Revenue</strong> = Money received from clients (invoices paid)</li>
                  <li>• <strong>Expenses</strong> = Money paid out (session payments + other costs)</li>
                  <li>• <strong>Net Profit</strong> = Revenue - Expenses - Outstanding Payments</li>
                  <li>• <strong>Owed to Musicians</strong> = Unpaid session payments</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-white/5 backdrop-blur-sm border-green-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-gray-400">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-white">£{totalRevenue.toFixed(0)}</div>
                <TrendingUp className="w-6 h-6 text-green-500" />
              </div>
              <p className="text-xs text-gray-500 mt-1">From clients</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-sm border-orange-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-gray-400">Total Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-white">£{totalExpenses.toFixed(0)}</div>
                <TrendingDown className="w-6 h-6 text-orange-500" />
              </div>
              <p className="text-xs text-gray-500 mt-1">Paid out</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-sm border-purple-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-gray-400">Net Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  £{netProfit.toFixed(0)}
                </div>
                <Building2 className="w-6 h-6 text-purple-500" />
              </div>
              <p className="text-xs text-gray-500 mt-1">After all obligations</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-sm border-yellow-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-gray-400">Owed to Musicians</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-yellow-400">£{totalOwedToMusicians.toFixed(0)}</div>
                <AlertCircle className="w-6 h-6 text-yellow-500" />
              </div>
              <p className="text-xs text-gray-500 mt-1">{unpaidSessionPayments.length} pending</p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Breakdown */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Band Income List */}
          <Card className="bg-white/5 backdrop-blur-sm border-green-500/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                Band Income Records
              </CardTitle>
              <p className="text-sm text-gray-400 mt-2">Income received from clients</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {bandIncomeRecords.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No income records for {selectedTaxYear}</p>
                ) : (
                  bandIncomeRecords.map(record => {
                    const invoice = invoices.find(inv => inv.id === record.invoice_id);
                    return (
                      <div key={record.id} className="p-3 bg-white/5 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-white">{record.venue_name}</p>
                          <p className="text-xs text-gray-400">{record.client_name} • {record.income_date}</p>
                          {record.invoice_id && invoice && (
                            <a 
                              href={invoice.pdf_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 mt-1 inline-flex items-center gap-1"
                            >
                              📄 Invoice: {record.invoice_id.substring(0, 8)}...
                            </a>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-green-400">£{record.amount.toFixed(2)}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Band Expenses List */}
          <Card className="bg-white/5 backdrop-blur-sm border-orange-500/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-orange-400" />
                Band Expenses
              </CardTitle>
              <p className="text-sm text-gray-400 mt-2">All band operating costs</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {bandExpenses.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No expenses for {selectedTaxYear}</p>
                ) : (
                  bandExpenses.map(expense => {
                    // For session payments, show the session invoice (receipt_url)
                    // For other expenses, show the client invoice
                    const isSessionPayment = expense.category === 'session_payment';
                    const invoiceUrl = isSessionPayment ? expense.receipt_url : invoices.find(inv => inv.id === expense.invoice_id)?.pdf_url;
                    const invoiceLabel = isSessionPayment ? 'Session Invoice' : 'Client Invoice';
                    
                    return (
                      <div key={expense.id} className="p-3 bg-white/5 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-white">{expense.description}</p>
                          <p className="text-xs text-gray-400">{expense.category} • {expense.expense_date}</p>
                          {invoiceUrl && (
                            <a 
                              href={invoiceUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 mt-1 inline-flex items-center gap-1"
                            >
                              📄 {invoiceLabel}
                            </a>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-orange-400">£{expense.amount.toFixed(2)}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Session Payment Tracker */}
        <div className="mb-8">
          <SessionPaymentTracker />
        </div>
      </div>
    </div>
  );
}
