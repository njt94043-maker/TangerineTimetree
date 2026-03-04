import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function RegenerateMissingPDFs() {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices-missing-pdfs'],
    queryFn: () => base44.entities.Invoice.list(),
    initialData: [],
  });

  const missingPDFs = invoices.filter(inv => !inv.pdf_url || inv.pdf_url.trim() === '');

  if (missingPDFs.length === 0) {
    return null;
  }

  const regenerateAllPDFs = async () => {
    console.log('🔄 STARTING PDF REGENERATION');
    console.log('Invoices without PDFs:', missingPDFs.length);
    
    setGenerating(true);
    setProgress({ current: 0, total: missingPDFs.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < missingPDFs.length; i++) {
      const invoice = missingPDFs[i];
      setProgress({ current: i + 1, total: missingPDFs.length });

      console.log(`\n📄 Regenerating PDF ${i + 1}/${missingPDFs.length}`);
      console.log('Invoice:', invoice.invoice_number, 'ID:', invoice.id);

      try {
        // Use backend function to generate PDF
        const pdfResult = await base44.functions.invoke('generateInvoicePdf', {
          invoice_id: invoice.id
        });
        
        console.log('PDF Result:', JSON.stringify(pdfResult, null, 2));
        
        if (pdfResult.data && pdfResult.data.pdf_url) {
          await base44.entities.Invoice.update(invoice.id, { pdf_url: pdfResult.data.pdf_url });
          console.log(`✅ PDF saved: ${pdfResult.data.pdf_url}`);
          successCount++;
        } else {
          console.error(`⚠️ No PDF URL found in result for invoice ${invoice.id}`);
          failCount++;
        }
      } catch (error) {
        console.error(`❌ Failed to generate PDF for invoice ${invoice.id}`);
        console.error('Error message:', error.message);
        failCount++;
      }
    }

    setGenerating(false);
    
    console.log('\n📊 PDF REGENERATION COMPLETE');
    console.log('Success:', successCount);
    console.log('Failed:', failCount);

    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['invoices-missing-pdfs'] });

    if (successCount > 0) {
      toast.success(`Generated ${successCount} invoice PDF${successCount !== 1 ? 's' : ''}!`);
    }
    if (failCount > 0) {
      toast.error(`Failed to generate ${failCount} PDF${failCount !== 1 ? 's' : ''}. Check console for details.`);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10 backdrop-blur-sm border-orange-500/30 mb-6">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-orange-400" />
            Missing Invoice PDFs
          </div>
          <Badge className="bg-orange-500/20 text-orange-400">
            {missingPDFs.length} missing
          </Badge>
        </CardTitle>
        <p className="text-sm text-gray-400 mt-2">
          Some invoices don't have PDF files generated. Click to regenerate them.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {generating && (
          <div className="bg-white/5 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-300">Generating PDFs...</span>
              <span className="text-sm text-orange-400 font-medium">
                {progress.current} / {progress.total}
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full transition-all"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <Button
          onClick={regenerateAllPDFs}
          disabled={generating}
          className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 h-12"
        >
          {generating ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Generating {progress.current}/{progress.total}...
            </>
          ) : (
            <>
              <FileText className="w-5 h-5 mr-2" />
              Regenerate All {missingPDFs.length} Missing PDFs
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}