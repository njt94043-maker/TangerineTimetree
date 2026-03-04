import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Calendar, PoundSterling, ExternalLink } from "lucide-react";
import { format } from "date-fns";

export default function BandInvoices() {
  const navigate = useNavigate();
  const [user, setUser] = React.useState(null);
  
  const getCurrentTaxYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const taxYearStart = new Date(currentYear, 3, 6);
    return now >= taxYearStart ? `${currentYear}-${currentYear + 1}` : `${currentYear - 1}-${currentYear}`;
  };

  const [selectedTaxYear, setSelectedTaxYear] = useState(getCurrentTaxYear());

  const generateTaxYears = () => {
    const years = [];
    const currentYear = new Date().getFullYear();
    for (let i = 0; i < 4; i++) {
      const year = currentYear - i;
      years.push(`${year}-${year + 1}`);
    }
    return years;
  };

  React.useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await base44.auth.me();
        if (!userData.is_band_manager) {
          navigate(createPageUrl("Dashboard"));
        }
        setUser(userData);
      } catch (error) {
        await base44.auth.redirectToLogin(window.location.pathname);
      }
    };
    checkAuth();
  }, [navigate]);

  const { data: invoices = [] } = useQuery({
    queryKey: ['all-invoices', selectedTaxYear],
    queryFn: async () => {
      const all = await base44.entities.Invoice.list('-issue_date');
      return all.filter(inv => inv.tax_year === selectedTaxYear);
    },
    initialData: [],
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['band-expenses-invoices', selectedTaxYear],
    queryFn: async () => {
      const all = await base44.entities.Expense.list('-expense_date');
      return all.filter(e => e.expense_type === 'band' && e.tax_year === selectedTaxYear && e.invoice_id);
    },
    initialData: [],
  });

  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Band Invoices & Receipts</h1>
          <p className="text-gray-400">All invoice documents for tax purposes</p>
        </div>

        <Card className="bg-white/5 backdrop-blur-sm border-blue-500/20 mb-6">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <Calendar className="w-5 h-5 text-blue-400" />
              <div className="flex-1">
                <label className="text-gray-300 text-sm">Tax Year</label>
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
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="bg-white/5 backdrop-blur-sm border-green-500/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <span>Client Invoices (Income)</span>
                <Badge className="bg-green-500/20 text-green-400">
                  £{totalInvoiced.toFixed(0)}
                </Badge>
              </CardTitle>
              <p className="text-sm text-gray-400 mt-2">Invoices sent to clients</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {invoices.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No invoices for {selectedTaxYear}</p>
                ) : (
                  invoices.map(invoice => (
                    <div key={invoice.id} className="p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-all">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-white">{invoice.invoice_number}</p>
                          <p className="text-sm text-gray-400">{invoice.client_name}</p>
                          <p className="text-xs text-gray-500">
                            Issued: {format(new Date(invoice.issue_date), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-400">£{invoice.amount.toFixed(2)}</p>
                          {invoice.paid && (
                            <Badge className="bg-green-500/20 text-green-400 text-xs">Paid</Badge>
                          )}
                        </div>
                      </div>
                      {invoice.pdf_url ? (
                        <a
                          href={invoice.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 mt-2"
                        >
                          <FileText className="w-4 h-4" />
                          View PDF Invoice
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <p className="text-xs text-red-400 mt-2">⚠️ PDF not generated</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-sm border-orange-500/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <span>Band Expenses (with invoices)</span>
                <Badge className="bg-orange-500/20 text-orange-400">
                  £{totalExpenses.toFixed(0)}
                </Badge>
              </CardTitle>
              <p className="text-sm text-gray-400 mt-2">Expenses linked to invoice receipts</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {expenses.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No expenses with invoices for {selectedTaxYear}</p>
                ) : (
                  expenses.map(expense => {
                    const relatedInvoice = invoices.find(inv => inv.id === expense.invoice_id);
                    return (
                      <div key={expense.id} className="p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-all">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-medium text-white">{expense.description}</p>
                            <p className="text-sm text-gray-400">{expense.category}</p>
                            <p className="text-xs text-gray-500">
                              {format(new Date(expense.expense_date), 'MMM d, yyyy')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-orange-400">£{expense.amount.toFixed(2)}</p>
                          </div>
                        </div>
                        {relatedInvoice?.pdf_url ? (
                          <a
                            href={relatedInvoice.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 mt-2"
                          >
                            <FileText className="w-4 h-4" />
                            View Invoice Receipt
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <p className="text-xs text-gray-500 mt-2">Invoice: {expense.invoice_id?.substring(0, 8)}...</p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}