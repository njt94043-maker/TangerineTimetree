
import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Upload, Receipt, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import ExpenseForm from "../components/expenses/ExpenseForm";
import ExpenseList from "../components/expenses/ExpenseList";
import QuickExpenseUpload from "../components/expenses/QuickExpenseUpload";
import CombinedMileageTracker from "../components/expenses/CombinedMileageTracker";
import { toast } from "sonner";

export default function Expenses() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showQuickUpload, setShowQuickUpload] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [showPersonalExpenses, setShowPersonalExpenses] = useState(true);
  const [showBandExpenses, setShowBandExpenses] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (error) {
        // If there's an error, it means no user is logged in or session expired.
        // The app will now function publicly without a user.
        setUser(null);
      }
    };
    loadUser();
  }, []); // Empty dependency array means this runs once on mount.

  const { data: allExpenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list('-expense_date'),
    initialData: [],
    // Removed enabled: !!user, so expenses are fetched regardless of user login status.
  });

  const { data: mileageRecords = [] } = useQuery({
    queryKey: ['mileage-records'],
    queryFn: () => base44.entities.MileageRecord.list('-event_date'),
    initialData: [],
    // Removed enabled: !!user, so mileage records are fetched regardless of user login status.
  });

  // These filters will correctly return empty arrays if 'user' is null.
  const personalExpenses = user ? allExpenses.filter(e => e.expense_type === 'personal' && e.member_email === user.email) : [];
  const bandExpenses = allExpenses.filter(e => 
    e.expense_type === 'band' && 
    e.category !== 'fuel' && 
    e.category !== 'transport' &&
    e.category !== 'session_payment'
  );

  const personalMileage = user ? mileageRecords.filter(m => m.member_email === user.email) : [];
  const totalPersonalExpenses = personalExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalPersonalMileage = personalMileage.reduce((sum, m) => sum + (m.total_claim || 0), 0);
  const totalBandExpenses = bandExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const createExpenseMutation = useMutation({
    mutationFn: (expenseData) => base44.entities.Expense.create(expenseData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setShowExpenseForm(false);
      setEditingExpense(null);
      toast.success('Expense added successfully');
    },
    onError: (error) => {
      toast.error(`Failed to add expense: ${error.message || 'Unknown error'}`);
    }
  });

  const updateExpenseMutation = useMutation({
    mutationFn: ({ id, expenseData }) => base44.entities.Expense.update(id, expenseData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setShowExpenseForm(false);
      setEditingExpense(null);
      toast.success('Expense updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update expense: ${error.message || 'Unknown error'}`);
    }
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (id) => base44.entities.Expense.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete expense: ${error.message || 'Unknown error'}`);
    }
  });

  const handleSubmit = (expenseData) => {
    if (editingExpense) {
      updateExpenseMutation.mutate({ id: editingExpense.id, expenseData });
    } else {
      createExpenseMutation.mutate(expenseData);
    }
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setShowExpenseForm(false); // Make sure the form is hidden when just setting editing expense
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      deleteExpenseMutation.mutate(id);
    }
  };

  // Removed the 'if (!user)' loading spinner, as the app is now public and renders immediately.

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">My Expenses</h1>
            <p className="text-gray-400">Track your personal expenses and mileage</p>
          </div>
          <div className="flex gap-3">
            {!showQuickUpload && !showExpenseForm && (
              <Button
                onClick={() => setShowQuickUpload(true)}
                className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
              >
                <Upload className="w-5 h-5 mr-2" />
                Quick Upload
              </Button>
            )}
            <Button
              onClick={() => {
                setEditingExpense(null);
                setShowExpenseForm(true);
                setShowQuickUpload(false);
              }}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Expense
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="bg-white/5 backdrop-blur-sm border-green-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-gray-400">Personal Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold text-white">£{totalPersonalExpenses.toFixed(2)}</div>
                  <Receipt className="w-6 h-6 text-green-500" />
                </div>
                <p className="text-xs text-gray-500 mt-1">{personalExpenses.length} expenses</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="bg-white/5 backdrop-blur-sm border-blue-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-gray-400">Mileage Claims</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold text-white">£{totalPersonalMileage.toFixed(2)}</div>
                  <Receipt className="w-6 h-6 text-blue-500" />
                </div>
                <p className="text-xs text-gray-500 mt-1">{personalMileage.length} journeys</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="bg-white/5 backdrop-blur-sm border-purple-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-gray-400">Total Tax Deductions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold text-white">£{(totalPersonalExpenses + totalPersonalMileage).toFixed(2)}</div>
                  <Receipt className="w-6 h-6 text-purple-500" />
                </div>
                <p className="text-xs text-gray-500 mt-1">Current tax year</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {showQuickUpload && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <QuickExpenseUpload
              onClose={() => setShowQuickUpload(false)}
              currentUser={user} // Pass user, even if null, so component can adapt
              onExpenseAdded={() => {
                setShowQuickUpload(false);
                queryClient.invalidateQueries({ queryKey: ['expenses'] });
              }}
            />
          </motion.div>
        )}

        {showExpenseForm && !editingExpense && (
          <ExpenseForm
            expense={null}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowExpenseForm(false);
              setEditingExpense(null);
            }}
            isSubmitting={createExpenseMutation.isPending || updateExpenseMutation.isPending}
            currentUser={user} // Pass user, even if null, so component can adapt
          />
        )}

        <div className="mb-8">
          <CombinedMileageTracker currentUser={user} /> {/* Pass user, even if null, so component can adapt */}
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Receipt className="w-6 h-6 text-purple-400" />
              My Personal Expenses
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPersonalExpenses(!showPersonalExpenses)}
              className="text-gray-400"
            >
              {showPersonalExpenses ? 'Hide' : 'Show'}
            </Button>
          </div>
          {showPersonalExpenses && (
            <ExpenseList
              expenses={personalExpenses}
              editingExpense={editingExpense}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onSubmitEdit={handleSubmit}
              onCancelEdit={() => setEditingExpense(null)}
              isSubmitting={createExpenseMutation.isPending || updateExpenseMutation.isPending}
              currentUser={user} // Pass user, even if null, so component can adapt
            />
          )}
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Receipt className="w-6 h-6 text-orange-400" />
              Other Band Expenses (Shared)
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowBandExpenses(!showBandExpenses)}
              className="text-gray-400"
            >
              {showBandExpenses ? 'Hide' : 'Show'}
            </Button>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            Shared band expenses (excluding session payments and mileage which are tracked separately)
          </p>
          {showBandExpenses && (
            <ExpenseList
              expenses={bandExpenses}
              editingExpense={editingExpense}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onSubmitEdit={handleSubmit}
              onCancelEdit={() => setEditingExpense(null)}
              isSubmitting={createExpenseMutation.isPending || updateExpenseMutation.isPending}
              currentUser={user} // Pass user, even if null, so component can adapt
            />
          )}
        </div>
      </div>
    </div>
  );
}
