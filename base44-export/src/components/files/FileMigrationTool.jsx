
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function FileMigrationTool() {
  const queryClient = useQueryClient();
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState(null);

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices-for-migration'],
    queryFn: () => base44.entities.Invoice.list(),
    initialData: [],
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses-for-migration'],
    queryFn: () => base44.entities.Expense.list(),
    initialData: [],
  });

  const { data: photos = [] } = useQuery({
    queryKey: ['photos-for-migration'],
    queryFn: () => base44.entities.Photo.list(),
    initialData: [],
  });

  const { data: videos = [] } = useQuery({
    queryKey: ['videos-for-migration'],
    queryFn: () => base44.entities.Video.list(),
    initialData: [],
  });

  const { data: sessionPayments = [] } = useQuery({
    queryKey: ['session-payments-for-migration'],
    queryFn: () => base44.entities.SessionPayment.list(),
    initialData: [],
  });

  const { data: existingFiles = [] } = useQuery({
    queryKey: ['existing-file-storage'],
    queryFn: () => base44.entities.FileStorage.list(),
    initialData: [],
  });

  const migrateFiles = async () => {
    setMigrating(true);
    setResults(null);
    
    const filesToCreate = [];
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // Helper to check if file already exists
    const fileExists = (url) => existingFiles.some(f => f.file_url === url);

    // Migrate Invoice PDFs
    console.log('📄 Migrating invoice PDFs...');
    for (const invoice of invoices) {
      if (invoice.pdf_url && !fileExists(invoice.pdf_url)) {
        filesToCreate.push({
          file_name: `Invoice ${invoice.invoice_number}.pdf`,
          file_url: invoice.pdf_url,
          file_type: 'pdf',
          category: 'invoices',
          subcategory: 'client_invoice',
          uploaded_by_email: invoice.created_by || 'system',
          uploaded_by_name: invoice.client_name,
          related_entity: 'Invoice',
          related_entity_id: invoice.id,
          description: `Client invoice for ${invoice.client_name}`,
          tags: ['invoice', 'client', invoice.invoice_number],
          visible_to_all: true
        });
      } else if (invoice.pdf_url) {
        skipCount++;
      }
    }

    // Migrate Expense Receipts
    console.log('🧾 Migrating expense receipts...');
    for (const expense of expenses) {
      if (expense.receipt_url && !fileExists(expense.receipt_url)) {
        filesToCreate.push({
          file_name: `${expense.description || 'Receipt'} - ${expense.expense_date}.pdf`,
          file_url: expense.receipt_url,
          file_type: 'pdf',
          category: 'receipts',
          subcategory: 'expense_receipt',
          uploaded_by_email: expense.member_email,
          uploaded_by_name: expense.member_name,
          related_entity: 'Expense',
          related_entity_id: expense.id,
          description: `Receipt for ${expense.description}`,
          tags: ['receipt', 'expense', expense.category],
          visible_to_all: expense.expense_type === 'band'
        });
      } else if (expense.receipt_url) {
        skipCount++;
      }
    }

    // Migrate Photos
    console.log('📸 Migrating photos...');
    for (const photo of photos) {
      if (photo.image_url && !fileExists(photo.image_url)) {
        filesToCreate.push({
          file_name: `${photo.title}.jpg`,
          file_url: photo.image_url,
          file_type: 'image',
          category: 'photos',
          subcategory: 'live_performance',
          uploaded_by_email: photo.created_by || 'system',
          uploaded_by_name: 'Band Admin',
          related_entity: 'Photo',
          related_entity_id: photo.id,
          description: photo.title,
          tags: ['photo', photo.location].filter(Boolean),
          visible_to_all: photo.visible_to_public !== false
        });
      } else if (photo.image_url) {
        skipCount++;
      }
    }

    // Migrate Videos (thumbnails)
    console.log('🎥 Migrating video thumbnails...');
    for (const video of videos) {
      if (video.thumbnail_url && !fileExists(video.thumbnail_url)) {
        filesToCreate.push({
          file_name: `${video.title} - Thumbnail.jpg`,
          file_url: video.thumbnail_url,
          file_type: 'image',
          category: 'videos',
          subcategory: 'promo',
          uploaded_by_email: video.created_by || 'system',
          uploaded_by_name: 'Band Admin',
          related_entity: 'Video',
          related_entity_id: video.id,
          description: `Thumbnail for ${video.title}`,
          tags: ['video', 'thumbnail', video.venue].filter(Boolean),
          visible_to_all: video.visible_to_public !== false
        });
      } else if (video.thumbnail_url) {
        skipCount++;
      }
    }

    // Migrate Session Payment Invoices
    console.log('💼 Migrating session invoices...');
    for (const payment of sessionPayments) {
      if (payment.session_invoice_pdf_url && !fileExists(payment.session_invoice_pdf_url)) {
        filesToCreate.push({
          file_name: `Session Invoice - ${payment.musician_name} - ${payment.event_date}.pdf`,
          file_url: payment.session_invoice_pdf_url,
          file_type: 'pdf',
          category: 'invoices',
          subcategory: 'session_invoice',
          uploaded_by_email: payment.musician_email,
          uploaded_by_name: payment.musician_name,
          related_entity: 'SessionPayment',
          related_entity_id: payment.id,
          description: `Session musician invoice for ${payment.venue_name}`,
          tags: ['invoice', 'session', payment.musician_name],
          visible_to_all: true
        });
      } else if (payment.session_invoice_pdf_url) {
        skipCount++;
      }
    }

    console.log(`📊 Found ${filesToCreate.length} files to migrate`);
    console.log(`⏭️ Skipping ${skipCount} files (already exist)`);
    
    setProgress({ current: 0, total: filesToCreate.length });

    // Create files in batches
    const batchSize = 10;
    for (let i = 0; i < filesToCreate.length; i += batchSize) {
      const batch = filesToCreate.slice(i, i + batchSize);
      setProgress({ current: Math.min(i + batchSize, filesToCreate.length), total: filesToCreate.length });
      
      try {
        await base44.entities.FileStorage.bulkCreate(batch);
        successCount += batch.length;
      } catch (error) {
        console.error('Error migrating batch:', error);
        errorCount += batch.length;
      }
    }

    setResults({ successCount, skipCount, errorCount });
    setMigrating(false);
    queryClient.invalidateQueries({ queryKey: ['file-storage'] });
    
    if (successCount > 0) {
      toast.success(`Migrated ${successCount} files successfully!`);
    }
  };

  const totalPotentialFiles = 
    invoices.filter(i => i.pdf_url).length +
    expenses.filter(e => e.receipt_url).length +
    photos.filter(p => p.image_url).length +
    videos.filter(v => v.thumbnail_url).length +
    sessionPayments.filter(s => s.session_invoice_pdf_url).length;

  const alreadyMigrated = existingFiles.length;
  const needsMigration = totalPotentialFiles - alreadyMigrated;

  // ALWAYS show the migration tool if there are files to migrate OR if we just migrated
  if (needsMigration <= 0 && !results && existingFiles.length > 0) {
    return null; // Hide if everything is already migrated and no recent migration
  }

  // Show if files need migration OR no files exist yet (to inform user)
  return (
    <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 backdrop-blur-sm border-blue-500/30 mb-6">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-400" />
            File Migration Tool
          </div>
          <Badge className="bg-blue-500/20 text-blue-400">
            {needsMigration} files to migrate
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="text-blue-300 font-medium">Migrate existing files to File Storage:</p>
              <ul className="text-gray-300 space-y-1 list-disc list-inside">
                <li>{invoices.filter(i => i.pdf_url).length} invoice PDFs</li>
                <li>{expenses.filter(e => e.receipt_url).length} expense receipts</li>
                <li>{photos.filter(p => p.image_url).length} photos</li>
                <li>{videos.filter(v => v.thumbnail_url).length} video thumbnails</li>
                <li>{sessionPayments.filter(s => s.session_invoice_pdf_url).length} session invoices</li>
              </ul>
              <p className="text-gray-400 text-xs mt-2">
                Already migrated: {alreadyMigrated} files
              </p>
            </div>
          </div>
        </div>

        {migrating && (
          <div className="bg-white/5 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-300">Migrating files...</span>
              <span className="text-sm text-blue-400 font-medium">
                {progress.current} / {progress.total}
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all"
                style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {results && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-400 mb-2">
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold">Migration Complete!</span>
            </div>
            <div className="text-sm text-gray-300 space-y-1">
              <p>✅ Successfully migrated: {results.successCount} files</p>
              <p>⏭️ Skipped (already exist): {results.skipCount} files</p>
              {results.errorCount > 0 && (
                <p className="text-red-400">❌ Errors: {results.errorCount} files</p>
              )}
            </div>
          </div>
        )}

        <Button
          onClick={migrateFiles}
          disabled={migrating || needsMigration === 0}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 h-12"
        >
          {migrating ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Migrating {progress.current}/{progress.total}...
            </>
          ) : (
            <>
              <Database className="w-5 h-5 mr-2" />
              Migrate {needsMigration} Files to File Storage
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
