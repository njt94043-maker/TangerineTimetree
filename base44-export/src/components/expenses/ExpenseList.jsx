
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Receipt, FileText, ChevronDown, ChevronUp, History } from "lucide-react";
import { format } from "date-fns";
import ExpenseForm from "./ExpenseForm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery } from '@tanstack/react-query';

// Assuming base44 is an API client or similar utility that provides entity methods
// This import path might need adjustment based on your project structure.
// For the purpose of providing a valid file, we'll assume it's available via import.
import { base44 } from '@/api/base44Client';


export default function ExpenseList({ expenses, editingExpense, onEdit, onDelete, onSubmitEdit, onCancelEdit, isSubmitting, currentUser }) {
  // Add null check for currentUser
  if (!currentUser) {
    return null;
  }

  const [showAllExpenses, setShowAllExpenses] = useState(false);
  const [showPreviousTaxYears, setShowPreviousTaxYears] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const INITIAL_DISPLAY_COUNT = 5;

  // Query invoices to get PDF URLs
  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices-for-expense-links'],
    queryFn: () => base44.entities.Invoice.list(),
    initialData: [],
  });

  const categoryColors = {
    equipment: "bg-blue-500/20 text-blue-400",
    instruments: "bg-purple-500/20 text-purple-400",
    maintenance: "bg-orange-500/20 text-orange-400",
    fuel: "bg-green-500/20 text-green-400",
    accommodation: "bg-pink-500/20 text-pink-400",
    food: "bg-yellow-500/20 text-yellow-400",
    transport: "bg-cyan-500/20 text-cyan-400",
    rehearsal_space: "bg-indigo-500/20 text-indigo-400",
    recording: "bg-red-500/20 text-red-400",
    marketing: "bg-emerald-500/20 text-emerald-400",
    session_payment: "bg-violet-500/20 text-violet-400",
    other: "bg-gray-500/20 text-gray-400"
  };

  const categoryLabels = {
    equipment: 'Equipment',
    instruments: 'Instruments',
    maintenance: 'Maintenance',
    fuel: 'Fuel',
    accommodation: 'Accommodation',
    food: 'Food/Drinks',
    transport: 'Transport',
    rehearsal_space: 'Rehearsal Space',
    recording: 'Recording',
    marketing: 'Marketing',
    session_payment: 'Session Payment',
    other: 'Other'
  };

  // Get current tax year
  const getCurrentTaxYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const taxYearStart = new Date(currentYear, 3, 6); // April 6th
    return now >= taxYearStart ? `${currentYear}-${currentYear + 1}` : `${currentYear - 1}-${currentYear}`;
  };

  const currentTaxYear = getCurrentTaxYear();

  const groupedByTaxYear = expenses.reduce((acc, expense) => {
    const taxYear = expense.tax_year || 'Unknown';
    if (!acc[taxYear]) acc[taxYear] = [];
    acc[taxYear].push(expense);
    return acc;
  }, {});

  const sortedTaxYears = Object.keys(groupedByTaxYear).sort().reverse();

  // Separate current year from previous years
  const currentYearData = sortedTaxYears.filter(year => year === currentTaxYear);
  const previousYears = sortedTaxYears.filter(year => year !== currentTaxYear);

  if (expenses.length === 0) {
    return (
      <Card className="bg-white/5 backdrop-blur-sm border-white/10">
        <CardContent className="py-20 text-center">
          <FileText className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">No expenses recorded yet</p>
          <p className="text-gray-500 text-sm mt-2">Add your first expense to start tracking</p>
        </CardContent>
      </Card>
    );
  };

  const handleEdit = (expense) => {
    if (onEdit) {
      onEdit(expense);
    }
  };

  const handleDeleteClick = (expense) => {
    setExpenseToDelete(expense);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (expenseToDelete && onDelete) {
      onDelete(expenseToDelete.id);
    }
    setDeleteDialogOpen(false);
    setExpenseToDelete(null);
  };

  const renderTaxYearCard = (taxYear) => {
    const yearExpenses = groupedByTaxYear[taxYear];
    const yearTotal = yearExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const sortedExpenses = yearExpenses.sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date));

    const displayedExpenses = showAllExpenses ? sortedExpenses : sortedExpenses.slice(0, INITIAL_DISPLAY_COUNT);
    const hasMore = sortedExpenses.length > INITIAL_DISPLAY_COUNT;

    return (
      <Card key={taxYear} className="bg-white/5 backdrop-blur-sm border-purple-500/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">Tax Year {taxYear}</CardTitle>
            <Badge className="bg-purple-500/20 text-purple-400">
              £{yearTotal.toFixed(2)} total
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {displayedExpenses.map((expense) => {
                const isBeingEdited = editingExpense?.id === expense.id;

                return (
                  <React.Fragment key={expense.id}>
                    <div
                      id={`expense-${expense.id}`}
                      className="p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-all"
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h4 className="font-semibold text-white">{expense.description}</h4>
                            <Badge className={categoryColors[expense.category] || categoryColors.other}>
                              {categoryLabels[expense.category] || expense.category}
                            </Badge>
                            {expense.expense_type === 'band' && (
                              <Badge className="bg-orange-500/20 text-orange-400">
                                Band Expense
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-400">
                            {format(new Date(expense.expense_date), 'MMMM d, yyyy')}
                            {expense.expense_type === 'band' && expense.member_name && (
                              <span className="ml-2">• Added by {expense.member_name}</span>
                            )}
                          </p>
                          {expense.notes && (
                            <p className="text-sm text-gray-500 mt-2">{expense.notes}</p>
                          )}
                          {expense.invoice_id && (() => {
                            const invoice = invoices.find(inv => inv.id === expense.invoice_id);
                            if (invoice && invoice.pdf_url) {
                              return (
                                <a
                                  href={invoice.pdf_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <FileText className="w-4 h-4" />
                                  View Invoice: {invoice.invoice_number}
                                </a>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xl font-bold text-white">£{expense.amount.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/10">
                        <div className="flex items-center gap-2">
                          {expense.receipt_url && (
                            <a
                              href={expense.receipt_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                            >
                              <Receipt className="w-4 h-4" />
                              <span className="hidden sm:inline">View Receipt</span>
                            </a>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleEdit(expense);
                            }}
                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 min-h-[44px] min-w-[44px]"
                            title="Edit expense"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteClick(expense);
                            }}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 min-h-[44px] min-w-[44px]"
                            title="Delete expense"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {isBeingEdited && (
                      <div className="ml-0 md:ml-4 mr-0 md:mr-4">
                        <ExpenseForm
                          expense={editingExpense}
                          onSubmit={onSubmitEdit}
                          onCancel={onCancelEdit}
                          isSubmitting={isSubmitting}
                          currentUser={currentUser}
                        />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}

            {hasMore && (
              <div className="pt-3">
                <Button
                  variant="outline"
                  onClick={() => setShowAllExpenses(!showAllExpenses)}
                  className="w-full border-white/10 text-gray-300 hover:bg-white/5 min-h-[44px]"
                >
                  {showAllExpenses ? (
                    <>
                      <ChevronUp className="w-4 h-4 mr-2" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4 mr-2" />
                      Show All ({sortedExpenses.length - INITIAL_DISPLAY_COUNT} more)
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <div className="space-y-6">
        {/* Current Tax Year - Always Visible */}
        {currentYearData.map(renderTaxYearCard)}

        {/* Previous Tax Years - Collapsible */}
        {previousYears.length > 0 && (
          <>
            <div className="pt-4">
              <Button
                variant="outline"
                onClick={() => setShowPreviousTaxYears(!showPreviousTaxYears)}
                className="w-full border-white/10 text-gray-400 hover:bg-white/5 hover:text-white min-h-[44px]"
              >
                {showPreviousTaxYears ? (
                  <>
                    <ChevronUp className="w-4 h-4 mr-2" />
                    Hide Previous Tax Years ({previousYears.length})
                  </>
                ) : (
                  <>
                    <History className="w-4 h-4 mr-2" />
                    Show Previous Tax Years ({previousYears.length})
                  </>
                )}
              </Button>
            </div>

            {showPreviousTaxYears && (
              <div className="space-y-6">
                {previousYears.map(renderTaxYearCard)}
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-gray-900 border-red-500/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Expense?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to delete the expense <strong className="text-white">{expenseToDelete?.description}</strong> for{' '}
              <strong className="text-white">£{expenseToDelete?.amount.toFixed(2)}</strong>?
              <br /><br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Expense
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
