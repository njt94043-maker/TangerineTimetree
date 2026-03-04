
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Loader2, Sparkles, Check, X, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function QuickExpenseUpload({ onClose, currentUser, onExpenseAdded }) {
  // Add null check for currentUser
  if (!currentUser) {
    return null;
  }

  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [extractedExpenses, setExtractedExpenses] = useState([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const createExpensesMutation = useMutation({
    mutationFn: (expenses) => base44.entities.Expense.bulkCreate(expenses),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success(`Created ${data.length} expense${data.length !== 1 ? 's' : ''} successfully!`);
      onClose();
      if (onExpenseAdded) {
        onExpenseAdded();
      }
    },
    onError: (error) => {
      console.error("Error creating expenses:", error);
      toast.error("Failed to create expenses. Please try again.");
    }
  });

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const oversizedFiles = files.filter(f => f.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast.error(`${oversizedFiles.length} file(s) too large. Maximum size is 10MB per file.`);
      return;
    }

    setUploading(true);
    setProcessing(true);
    setExtractedExpenses([]);
    setProgress({ current: 0, total: files.length });

    const expenses = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress({ current: i + 1, total: files.length });

      try {
        // Upload the file
        const { file_url } = await base44.integrations.Core.UploadFile({ file });

        // Extract expense data from the receipt
        const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url: file_url,
          json_schema: {
            type: "object",
            properties: {
              description: {
                type: "string",
                description: "What was purchased or expense description"
              },
              amount: {
                type: "number",
                description: "Total amount in GBP (extract from total, convert if necessary)"
              },
              expense_date: {
                type: "string",
                description: "Date of purchase in YYYY-MM-DD format"
              },
              category: {
                type: "string",
                enum: ["equipment", "instruments", "maintenance", "fuel", "accommodation", "food", "transport", "rehearsal_space", "recording", "marketing", "other"],
                description: "Best matching expense category"
              },
              vendor: {
                type: "string",
                description: "Store or vendor name"
              },
              notes: {
                type: "string",
                description: "Any additional relevant details from receipt"
              }
            }
          }
        });

        if (result.status === 'success' && result.output) {
          const data = result.output;
          
          // Calculate tax year
          const expenseDate = new Date(data.expense_date || new Date());
          const year = expenseDate.getFullYear();
          // UK tax year starts April 6th
          const taxYearStartMonth = 3; // April is 3 (0-indexed)
          const taxYearStartDate = 6;
          
          let taxYearEndYear = year;
          if (expenseDate.getMonth() < taxYearStartMonth || (expenseDate.getMonth() === taxYearStartMonth && expenseDate.getDate() < taxYearStartDate)) {
              // If date is before April 6th of the current year, it belongs to the previous tax year
              taxYearEndYear = year;
          } else {
              // If date is on or after April 6th of the current year, it belongs to the current tax year
              taxYearEndYear = year + 1;
          }
          const taxYear = `${taxYearEndYear - 1}-${taxYearEndYear}`;


          expenses.push({
            ...data,
            tax_year: taxYear,
            receipt_url: file_url,
            member_email: currentUser.email,
            member_name: currentUser.full_name,
            file_name: file.name,
            status: 'success'
          });
        } else {
          expenses.push({
            file_name: file.name,
            status: 'error',
            error: result.details || 'Failed to extract data'
          });
        }

      } catch (error) {
        console.error('Error processing file:', error);
        expenses.push({
          file_name: file.name,
          status: 'error',
          error: error.message || 'Failed to process'
        });
      }
    }

    setExtractedExpenses(expenses);
    setUploading(false);
    setProcessing(false);

    const successCount = expenses.filter(e => e.status === 'success').length;
    const failCount = expenses.filter(e => e.status === 'error').length;
    
    if (successCount > 0 && failCount === 0) {
      toast.success(`Successfully processed ${successCount} receipt${successCount !== 1 ? 's' : ''}!`);
    } else if (successCount > 0 && failCount > 0) {
      toast.warning(`Processed ${successCount} receipts, ${failCount} failed.`);
    } else {
      toast.error('Failed to process receipts. Please try again.');
    }
  };

  const handleConfirm = () => {
    const validExpenses = extractedExpenses.filter(e => e.status === 'success');
    if (validExpenses.length === 0) return;
    
    createExpensesMutation.mutate(validExpenses);
  };

  const handleRemove = (index) => {
    setExtractedExpenses(extractedExpenses.filter((_, i) => i !== index));
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
    other: 'Other'
  };

  const validExpenses = extractedExpenses.filter(e => e.status === 'success');
  const failedExpenses = extractedExpenses.filter(e => e.status === 'error');

  return (
    <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-sm border-purple-500/30 mb-6">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            Quick Upload Receipts
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400">
            <X className="w-5 h-5" />
          </Button>
        </CardTitle>
        <p className="text-sm text-gray-400 mt-2">
          Upload multiple receipts and AI will extract expense details automatically
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {extractedExpenses.length === 0 && (
          <div className="space-y-3">
            <div className="border-2 border-dashed border-purple-500/30 rounded-lg p-8 text-center hover:border-purple-500/50 transition-all">
              <input
                id="receipt-upload"
                type="file"
                accept="image/*,application/pdf"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading || processing}
              />
              <label htmlFor="receipt-upload" className="cursor-pointer">
                {uploading || processing ? (
                  <div className="space-y-3">
                    <Loader2 className="w-12 h-12 text-purple-400 mx-auto animate-spin" />
                    <p className="text-gray-300 font-medium">
                      {uploading ? `Uploading receipts... (${progress.current}/${progress.total})` : 'Extracting expense data...'}
                    </p>
                    <p className="text-sm text-gray-500">This may take a few seconds</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload className="w-12 h-12 text-purple-400 mx-auto" />
                    <div>
                      <p className="text-gray-300 font-medium">Click to upload receipts</p>
                      <p className="text-sm text-gray-500 mt-1">
                        PNG, JPG or PDF (max 10MB each, multiple files)
                      </p>
                    </div>
                  </div>
                )}
              </label>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1 text-sm">
                  <p className="text-blue-300 font-medium">AI will extract from each receipt:</p>
                  <ul className="text-gray-400 space-y-1">
                    <li>• Purchase description</li>
                    <li>• Amount</li>
                    <li>• Date</li>
                    <li>• Vendor name</li>
                    <li>• Suggested category</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        <AnimatePresence>
          {extractedExpenses.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              {/* Summary */}
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">{validExpenses.length}</div>
                    <div className="text-xs text-gray-400">Successful</div>
                  </div>
                  {failedExpenses.length > 0 && (
                    <>
                      <div className="w-px h-8 bg-white/10"></div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-400">{failedExpenses.length}</div>
                        <div className="text-xs text-gray-400">Failed</div>
                      </div>
                    </>
                  )}
                  <div className="w-px h-8 bg-white/10"></div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">
                      £{validExpenses.reduce((sum, e) => sum + (e.amount || 0), 0).toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-400">Total</div>
                  </div>
                </div>
              </div>

              {/* Successful Expenses */}
              {validExpenses.length > 0 && (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {validExpenses.map((expense, index) => (
                    <div key={index} className="bg-white/5 border border-white/10 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-white">{expense.description}</h4>
                            <Badge className="bg-purple-500/20 text-purple-400">
                              {categoryLabels[expense.category] || expense.category}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-gray-400">Amount:</span>
                              <span className="text-white font-medium ml-2">£{expense.amount?.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Date:</span>
                              <span className="text-white ml-2">{expense.expense_date}</span>
                            </div>
                            {expense.vendor && (
                              <div className="col-span-2">
                                <span className="text-gray-400">Vendor:</span>
                                <span className="text-white ml-2">{expense.vendor}</span>
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-2">
                            File: {expense.file_name}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemove(extractedExpenses.indexOf(expense))}
                          className="text-red-400 hover:text-red-300"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      {expense.notes && (
                        <p className="text-sm text-gray-400 mt-2">{expense.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Failed Expenses */}
              {failedExpenses.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-red-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Failed to Process
                  </h4>
                  {failedExpenses.map((expense, index) => (
                    <div key={index} className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-white font-medium">{expense.file_name}</p>
                          <p className="text-xs text-red-400 mt-1">{expense.error}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemove(extractedExpenses.indexOf(expense))}
                          className="text-gray-400"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setExtractedExpenses([]);
                  }}
                  className="flex-1 border-white/10"
                >
                  Upload More
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={validExpenses.length === 0 || createExpensesMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600"
                >
                  {createExpensesMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Create {validExpenses.length} Expense{validExpenses.length !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
