
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Upload, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";

export default function ExpenseForm({ expense, onSubmit, onCancel, isSubmitting, currentUser, forceBandExpense }) {
  // Add null check for currentUser
  if (!currentUser) {
    console.warn("ExpenseForm mounted without a currentUser. Returning null.");
    return null;
  }

  const [formData, setFormData] = useState(expense || {
    expense_date: new Date().toISOString().split('T')[0],
    category: 'equipment',
    description: '',
    amount: '',
    receipt_url: '',
    notes: '',
    expense_type: forceBandExpense ? 'band' : 'personal', // Added new field for expense type, respects forceBandExpense
    member_email: currentUser.email,
    member_name: currentUser.full_name
  });
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File is too large. Maximum size is 10MB.');
      return;
    }

    setSelectedFile(file);
    setUploading(true);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, receipt_url: file_url });
      toast.success('Receipt uploaded!');
      
      // Create FileStorage record immediately
      try {
        await base44.entities.FileStorage.create({
          file_name: file.name,
          file_url: file_url,
          file_type: file.type.includes('pdf') ? 'pdf' : file.type.includes('image') ? 'image' : 'other',
          file_size: file.size,
          category: 'receipts',
          subcategory: 'expense_receipt',
          uploaded_by_email: currentUser.email,
          uploaded_by_name: currentUser.full_name,
          related_entity: 'Expense',
          description: `Receipt for ${formData.description || 'expense'}`,
          tags: ['receipt', 'expense'],
          visible_to_all: formData.expense_type === 'band'
        });
      } catch (error) {
        console.warn('Could not create FileStorage record:', error);
      }
    } catch (error) {
      toast.error('Failed to upload receipt. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Calculate tax year
    const expenseDate = new Date(formData.expense_date);
    const year = expenseDate.getFullYear();
    const taxYearStart = new Date(year, 3, 6); // April 6 (0-indexed month)
    const taxYear = expenseDate >= taxYearStart ? `${year}-${year + 1}` : `${year - 1}-${year}`;

    onSubmit({
      ...formData,
      amount: parseFloat(formData.amount),
      tax_year: taxYear,
      member_email: currentUser.email,
      member_name: currentUser.full_name
    });
  };

  const categoryLabels = {
    equipment: 'Equipment',
    instruments: 'Instruments',
    maintenance: 'Maintenance/Repairs',
    fuel: 'Fuel',
    accommodation: 'Accommodation',
    food: 'Food/Drinks',
    transport: 'Transport',
    rehearsal_space: 'Rehearsal Space',
    recording: 'Recording/Studio',
    marketing: 'Marketing/Promotion',
    session_payment: 'Session Musician Payment',
    other: 'Other'
  };

  return (
    <Card className="bg-white/5 backdrop-blur-sm border-purple-500/20 mb-6">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <span className="text-lg sm:text-xl">{expense ? 'Edit Expense' : forceBandExpense ? 'Add Band Expense' : 'Add New Expense'}</span>
          <Button variant="ghost" size="icon" onClick={onCancel} className="text-gray-400 min-h-[44px] min-w-[44px]">
            <X className="w-5 h-5" />
          </Button>
        </CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {/* Expense Type Selection - Hide if forceBandExpense */}
          {!forceBandExpense && (
            <div className="space-y-2">
              <Label className="text-gray-300">Expense Type *</Label>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={formData.expense_type === 'personal' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, expense_type: 'personal' })}
                  className={`${formData.expense_type === 'personal' ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'border-white/10 text-white hover:bg-white/10'} w-1/2 min-h-[44px] text-base`}
                >
                  Personal Expense
                </Button>
                <Button
                  type="button"
                  variant={formData.expense_type === 'band' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, expense_type: 'band' })}
                  className={`${formData.expense_type === 'band' ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'border-white/10 text-white hover:bg-white/10'} w-1/2 min-h-[44px] text-base`}
                >
                  Band Expense
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                {formData.expense_type === 'personal' 
                  ? 'Only you can see this expense.' 
                  : 'All band members can see and edit this expense.'}
              </p>
            </div>
          )}

          {forceBandExpense && (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
              <p className="text-sm text-orange-300">
                📊 This expense will be added to the band's business records
              </p>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expense_date" className="text-gray-300">Date *</Label>
              <Input
                id="expense_date"
                type="date"
                value={formData.expense_date}
                onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                required
                className="bg-white/5 border-white/10 text-white h-12 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category" className="text-gray-300">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-12 text-base">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-gray-300">Description *</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              className="bg-white/5 border-white/10 text-white h-12 text-base"
              placeholder="e.g., Guitar strings, Rehearsal room hire"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount" className="text-gray-300">Amount (£) *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
              className="bg-white/5 border-white/10 text-white h-12 text-base"
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="receipt" className="text-gray-300">Receipt/Document</Label>
            <div className="flex flex-col gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('receipt').click()}
                disabled={uploading}
                className="border-white/10 h-auto min-h-[44px] text-base w-full"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : formData.receipt_url ? (
                  <>
                    <Receipt className="w-5 h-5 mr-2 text-green-400" />
                    Change Receipt
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 mr-2" />
                    Upload Receipt
                  </>
                )}
              </Button>
              {selectedFile && (
                <span className="text-sm text-gray-400 truncate px-2">{selectedFile.name}</span>
              )}
              {formData.receipt_url && (
                <a 
                  href={formData.receipt_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:text-blue-300 px-2"
                >
                  View uploaded receipt →
                </a>
              )}
            </div>
            <input
              id="receipt"
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-gray-300">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="bg-white/5 border-white/10 text-white min-h-[80px] text-base"
              placeholder="Additional notes about this expense..."
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} className="border-white/10 w-full sm:w-auto min-h-[44px] text-base">
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || uploading}
            className="bg-gradient-to-r from-purple-500 to-purple-600 w-full sm:w-auto min-h-[44px] text-base"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                {expense ? 'Update' : 'Add'} Expense
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
