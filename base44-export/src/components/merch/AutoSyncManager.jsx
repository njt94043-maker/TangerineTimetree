import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, RefreshCw, Sparkles, Clock, CheckCircle, AlertCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AutoSyncManager() {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, status: '' });

  // Get sync settings from AppSettings entity
  const { data: settings = [] } = useQuery({
    queryKey: ['merch-sync-settings'],
    queryFn: () => base44.entities.AppSettings.list(),
    initialData: [],
  });

  const syncSettings = settings.find(s => s.setting_key === 'merch_sync') || {
    setting_key: 'merch_sync',
    shop_url: '',
    auto_sync_enabled: false,
    sync_frequency: 'weekly',
    last_sync: null
  };

  const updateSettingsMutation = useMutation({
    mutationFn: async (data) => {
      const existing = settings.find(s => s.setting_key === 'merch_sync');
      if (existing) {
        return await base44.entities.AppSettings.update(existing.id, data);
      } else {
        return await base44.entities.AppSettings.create({ ...data, setting_key: 'merch_sync' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merch-sync-settings'] });
      toast.success('Sync settings updated!');
    },
  });

  const syncNow = async () => {
    if (!syncSettings.shop_url || !syncSettings.shop_url.includes('inkthreadable.co.uk')) {
      toast.error('Please set a valid InkThreadable shop URL first');
      return;
    }

    setSyncing(true);
    setProgress({ current: 0, total: 0, status: 'Analyzing shop...' });

    try {
      console.log('🔄 Starting shop sync from:', syncSettings.shop_url);
      setProgress({ current: 0, total: 0, status: 'AI analyzing InkThreadable shop...' });

      const extractionResult = await base44.integrations.Core.InvokeLLM({
        prompt: `
          Extract ALL product information from this InkThreadable shop: ${syncSettings.shop_url}
          
          For each product, extract:
          - name: Product name/title
          - description: Product description (if available)
          - price: Product price in GBP (number only, no £ symbol)
          - image_url: Main product image URL (full resolution)
          - purchase_url: Direct link to purchase this specific product
          - sizes: Available sizes (e.g., "S, M, L, XL" or leave empty if not applicable)
          
          IMPORTANT:
          - Use search engines/web access to get the actual product data
          - Extract ALL products from the shop
          - Ensure image URLs are direct links to images, not placeholders
          - Purchase URLs should be direct product page links
          - Return products in the order they appear on the shop
        `,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            products: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  price: { type: "number" },
                  image_url: { type: "string" },
                  purchase_url: { type: "string" },
                  sizes: { type: "string" }
                },
                required: ["name", "price", "image_url", "purchase_url"]
              }
            },
            total_products: { type: "number" }
          },
          required: ["products"]
        }
      });

      console.log('🎯 AI extraction result:', extractionResult);
      const products = extractionResult.products || [];
      
      if (products.length === 0) {
        toast.error('No products found in shop');
        setSyncing(false);
        return;
      }

      setProgress({ current: 0, total: products.length, status: 'Comparing with existing products...' });

      // Get existing products
      const existingProducts = await base44.entities.Merchandise.list();
      
      // Smart update: match by name and URL
      const updates = [];
      const newProducts = [];
      const deletedProducts = [...existingProducts];

      for (let i = 0; i < products.length; i++) {
        const shopProduct = products[i];
        const existing = existingProducts.find(p => 
          p.name === shopProduct.name || p.purchase_url === shopProduct.purchase_url
        );

        if (existing) {
          // Update existing product if price or details changed
          const needsUpdate = 
            existing.price !== shopProduct.price ||
            existing.description !== shopProduct.description ||
            existing.image_url !== shopProduct.image_url ||
            existing.sizes !== (shopProduct.sizes || '');

          if (needsUpdate) {
            updates.push({
              id: existing.id,
              data: {
                name: shopProduct.name,
                description: shopProduct.description || existing.description,
                price: shopProduct.price,
                image_url: shopProduct.image_url,
                purchase_url: shopProduct.purchase_url,
                sizes: shopProduct.sizes || '',
                order: i + 1
              }
            });
          } else {
            // Just update order if needed
            if (existing.order !== i + 1) {
              updates.push({
                id: existing.id,
                data: { order: i + 1 }
              });
            }
          }
          
          // Remove from deleted list
          const idx = deletedProducts.findIndex(p => p.id === existing.id);
          if (idx !== -1) deletedProducts.splice(idx, 1);
        } else {
          // New product
          newProducts.push({
            name: shopProduct.name,
            description: shopProduct.description || '',
            price: shopProduct.price,
            image_url: shopProduct.image_url,
            purchase_url: shopProduct.purchase_url,
            sizes: shopProduct.sizes || '',
            order: i + 1,
            featured: i === 0, // First product is featured
            available: true
          });
        }

        setProgress({ current: i + 1, total: products.length, status: 'Processing products...' });
      }

      // Apply updates
      let changesCount = 0;
      
      if (newProducts.length > 0) {
        await base44.entities.Merchandise.bulkCreate(newProducts);
        changesCount += newProducts.length;
        console.log(`✅ Added ${newProducts.length} new products`);
      }

      if (updates.length > 0) {
        for (const update of updates) {
          await base44.entities.Merchandise.update(update.id, update.data);
        }
        changesCount += updates.length;
        console.log(`✅ Updated ${updates.length} products`);
      }

      // Mark products that are no longer in shop as unavailable
      if (deletedProducts.length > 0) {
        for (const product of deletedProducts) {
          await base44.entities.Merchandise.update(product.id, { available: false });
        }
        console.log(`⚠️ Marked ${deletedProducts.length} products as unavailable`);
      }

      // Update last sync time
      await updateSettingsMutation.mutateAsync({
        ...syncSettings,
        last_sync: new Date().toISOString()
      });

      setProgress({ current: products.length, total: products.length, status: 'Complete!' });
      
      queryClient.invalidateQueries({ queryKey: ['merch-admin'] });
      queryClient.invalidateQueries({ queryKey: ['merch'] });
      
      if (changesCount > 0) {
        toast.success(`Shop synced! ${newProducts.length} added, ${updates.length} updated, ${deletedProducts.length} marked unavailable`);
      } else {
        toast.success('Shop is already up to date!');
      }
      
    } catch (error) {
      console.error('Sync error:', error);
      toast.error(`Sync failed: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    await updateSettingsMutation.mutateAsync({
      shop_url: formData.get('shop_url'),
      auto_sync_enabled: formData.get('auto_sync_enabled') === 'on',
      sync_frequency: formData.get('sync_frequency')
    });
  };

  const clearAllProducts = async () => {
    if (!window.confirm('Are you sure you want to DELETE ALL merchandise products? This cannot be undone!')) {
      return;
    }

    try {
      const allProducts = await base44.entities.Merchandise.list();
      for (const product of allProducts) {
        await base44.entities.Merchandise.delete(product.id);
      }
      
      queryClient.invalidateQueries({ queryKey: ['merch-admin'] });
      queryClient.invalidateQueries({ queryKey: ['merch'] });
      toast.success('All products deleted');
    } catch (error) {
      toast.error('Failed to delete products');
    }
  };

  return (
    <Card className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 backdrop-blur-sm border-purple-500/30 mb-8">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-purple-400" />
          Automatic Shop Sync
        </CardTitle>
        <p className="text-sm text-gray-400 mt-2">
          Keep your merchandise automatically synced with InkThreadable
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Sync Button */}
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
          <div>
            <p className="text-white font-medium">Quick Sync</p>
            <p className="text-xs text-gray-400">
              {syncSettings.last_sync 
                ? `Last synced: ${format(new Date(syncSettings.last_sync), 'PPp')}`
                : 'Never synced'}
            </p>
          </div>
          <Button
            onClick={syncNow}
            disabled={syncing || !syncSettings.shop_url}
            className="bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700"
          >
            {syncing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync Now
              </>
            )}
          </Button>
        </div>

        {syncing && (
          <div className="bg-white/5 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-300">{progress.status}</span>
              {progress.total > 0 && (
                <span className="text-sm text-purple-400 font-medium">
                  {progress.current} / {progress.total}
                </span>
              )}
            </div>
            {progress.total > 0 && (
              <div className="w-full bg-white/10 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Settings Form */}
        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="shop_url" className="text-gray-300">
              InkThreadable Shop URL
            </Label>
            <Input
              id="shop_url"
              name="shop_url"
              type="url"
              defaultValue={syncSettings.shop_url}
              placeholder="https://www.inkthreadable.co.uk/your-shop"
              className="bg-white/5 border-white/10 text-white"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
            <div>
              <Label htmlFor="auto_sync_enabled" className="text-gray-300 font-medium">
                Enable Automatic Sync
              </Label>
              <p className="text-xs text-gray-500 mt-1">
                Automatically check for updates periodically
              </p>
            </div>
            <Switch
              id="auto_sync_enabled"
              name="auto_sync_enabled"
              defaultChecked={syncSettings.auto_sync_enabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sync_frequency" className="text-gray-300">
              Sync Frequency
            </Label>
            <Select name="sync_frequency" defaultValue={syncSettings.sync_frequency}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            disabled={updateSettingsMutation.isPending}
            className="w-full bg-white/10 hover:bg-white/20"
          >
            Save Settings
          </Button>
        </form>

        {/* Info Box */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
          <p className="text-xs text-blue-300 mb-2">
            <strong>🤖 How Auto-Sync Works:</strong>
          </p>
          <ul className="text-xs text-gray-300 space-y-1 ml-4 list-disc">
            <li>Compares your InkThreadable shop with current products</li>
            <li>Adds new products automatically</li>
            <li>Updates prices and details if changed</li>
            <li>Marks removed products as unavailable</li>
            <li>Preserves your featured/availability settings</li>
          </ul>
        </div>

        {/* Danger Zone */}
        <div className="border-t border-red-500/20 pt-4">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <h4 className="text-red-300 font-semibold mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Danger Zone
            </h4>
            <p className="text-xs text-gray-400 mb-3">
              Delete all products and start fresh. This cannot be undone!
            </p>
            <Button
              onClick={clearAllProducts}
              variant="destructive"
              size="sm"
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete All Products
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}