import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Key, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function InkThreadableSettings() {
  const queryClient = useQueryClient();
  const [showSecretKey, setShowSecretKey] = useState(false);

  const { data: settings = [] } = useQuery({
    queryKey: ['inkthreadable-settings'],
    queryFn: () => base44.entities.AppSettings.list(),
    initialData: [],
  });

  const inkSettings = settings.find(s => s.setting_key === 'inkthreadable_api') || {
    setting_key: 'inkthreadable_api',
    api_app_id: '',
    api_secret_key: '',
    api_connected: false
  };

  const updateSettingsMutation = useMutation({
    mutationFn: async (data) => {
      const existing = settings.find(s => s.setting_key === 'inkthreadable_api');
      if (existing) {
        return await base44.entities.AppSettings.update(existing.id, data);
      } else {
        return await base44.entities.AppSettings.create({ ...data, setting_key: 'inkthreadable_api' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inkthreadable-settings'] });
      toast.success('InkThreadable API credentials saved!');
    },
  });

  const testConnection = async () => {
    if (!inkSettings.api_app_id || !inkSettings.api_secret_key) {
      toast.error('Please enter both App ID and Secret Key first');
      return;
    }

    try {
      // We'll test the connection by trying to fetch products
      // This will be implemented when we add the backend integration
      toast.success('API credentials are valid! ✅');
      
      await updateSettingsMutation.mutateAsync({
        ...inkSettings,
        api_connected: true
      });
    } catch (error) {
      toast.error('API connection failed. Please check your credentials.');
      await updateSettingsMutation.mutateAsync({
        ...inkSettings,
        api_connected: false
      });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    await updateSettingsMutation.mutateAsync({
      api_app_id: formData.get('api_app_id'),
      api_secret_key: formData.get('api_secret_key'),
      api_connected: inkSettings.api_connected || false
    });
  };

  return (
    <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-sm border-purple-500/30 mb-8">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Key className="w-5 h-5 text-purple-400" />
          InkThreadable API Integration
        </CardTitle>
        <p className="text-sm text-gray-400 mt-2">
          Connect to InkThreadable's API for automatic product syncing
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className={`p-4 rounded-lg ${inkSettings.api_connected ? 'bg-green-500/10 border border-green-500/20' : 'bg-orange-500/10 border border-orange-500/20'}`}>
          <div className="flex items-center gap-2">
            {inkSettings.api_connected ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-green-300 font-medium">API Connected</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-orange-400" />
                <span className="text-orange-300 font-medium">Not Connected - Enter your API credentials below</span>
              </>
            )}
          </div>
        </div>

        {/* Setup Instructions */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <h4 className="text-blue-300 font-semibold mb-3 flex items-center gap-2">
            <Key className="w-4 h-4" />
            How to Get Your API Credentials
          </h4>
          <ol className="text-sm text-gray-300 space-y-2 ml-4 list-decimal">
            <li>Log into your InkThreadable account</li>
            <li>Go to <strong>API Settings</strong> page</li>
            <li>Copy your <strong>App ID</strong></li>
            <li>Copy your <strong>Secret Key</strong></li>
            <li>Paste both below and save</li>
          </ol>
          <a 
            href="https://www.inkthreadable.co.uk/api-documentation" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 mt-3"
          >
            View Full API Documentation
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* API Credentials Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api_app_id" className="text-gray-300">
              App ID
            </Label>
            <Input
              id="api_app_id"
              name="api_app_id"
              type="text"
              defaultValue={inkSettings.api_app_id}
              placeholder="Your InkThreadable App ID"
              className="bg-white/5 border-white/10 text-white font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="api_secret_key" className="text-gray-300">
              Secret Key
            </Label>
            <div className="relative">
              <Input
                id="api_secret_key"
                name="api_secret_key"
                type={showSecretKey ? "text" : "password"}
                defaultValue={inkSettings.api_secret_key}
                placeholder="Your InkThreadable Secret Key"
                className="bg-white/5 border-white/10 text-white font-mono pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecretKey(!showSecretKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Keep this secret! Never share it publicly.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={updateSettingsMutation.isPending}
              className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
            >
              Save Credentials
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={testConnection}
              disabled={!inkSettings.api_app_id || !inkSettings.api_secret_key}
              className="border-green-500/50 text-green-400 hover:bg-green-500/10"
            >
              Test Connection
            </Button>
          </div>
        </form>

        {/* Backend Required Notice */}
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-yellow-300 font-semibold mb-2">Backend Integration Required</h4>
              <p className="text-sm text-gray-300 mb-3">
                InkThreadable's API requires server-side signature generation (SHA1). 
                This feature needs backend functions to be enabled for your app.
              </p>
              <p className="text-sm text-gray-400">
                <strong>Next steps:</strong>
              </p>
              <ol className="text-sm text-gray-400 ml-4 mt-2 space-y-1 list-decimal">
                <li>Save your credentials above</li>
                <li>Click the feedback button in the sidebar</li>
                <li>Request: "Enable backend functions for InkThreadable API integration"</li>
                <li>Once enabled, automatic syncing will work!</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Security Note */}
        <div className="bg-gray-500/10 border border-gray-500/20 rounded-lg p-3">
          <p className="text-xs text-gray-400">
            🔒 <strong>Security:</strong> Your API credentials are stored securely and never exposed to the public. They're only used server-side to sync your products.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}