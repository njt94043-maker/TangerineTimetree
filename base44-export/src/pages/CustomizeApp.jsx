
import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, ImageIcon, Palette, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function CustomizeApp() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Removed auth check - app is now public

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['app-settings'],
    queryFn: () => base44.entities.AppSettings.list(),
    initialData: [],
  });

  const currentSettings = settings.find(s => s.setting_key === 'main') || {
    setting_key: 'main',
    background_image_url: "https://scontent-lhr6-2.xx.fbcdn.net/v/t39.30808-6/518178779_122184618356318312_5797258311142432207_n.jpg?_nc_cat=105&ccb=1-7&_nc_sid=833d8c&_nc_ohc=rlt6b9CaUu8Q7kNvwG6g45-&_nc_oc=Adk62vL7XSa8pOejztLrwyMGZ54etI8HxQLjqLWsPrSjpFdVfg1UdGuCj_TYdbv8sQjp1f0m5ZoGJRIzoEHBj&_nc_zt=23&_nc_ht=scontent-lhr6-2.xx&_nc_gid=Qz1XBFQRdYGnGnN7LAY-A&oh=00_AfeX6yRb3zAb5H8cMut-vPc8OHh93Jnjs8hY5mMxPXVw&oe=69010C4E",
    logo_url: "https://scontent-lhr6-2.xx.fbcdn.net/v/t39.30808-6/567666137_122196871748318312_2444974931149722809_n.jpg?_nc_cat=105&ccb=1-7&_nc_sid=6ee11a&_nc_ohc=AZm2-beupR0Q7kNvwHoBIyN&_nc_oc=AdkO_zYzkDticI3IC9I7qLFWBCn7TJD1nfKb0JdRJGEGcAQ1YNuk-hzAEStExRT3BkpXwY4mBT9HgWeylfmVJc1&_nc_zt=23&_nc_ht=scontent-lhr6-2.xx&_nc_gid=u5gPfqxI-yDX-U926bKW8g&oh=00_AfddyIg81mFGf7BNXpsdCsPms5N5JMFBhy2cjRnX3VxvpQ&oe=6900F445"
  };

  const updateSettingsMutation = useMutation({
    mutationFn: async (data) => {
      const existing = settings.find(s => s.setting_key === 'main');
      if (existing) {
        return await base44.entities.AppSettings.update(existing.id, data);
      } else {
        return await base44.entities.AppSettings.create({ ...data, setting_key: 'main' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings'] });
      toast.success('Settings updated! Refresh the page to see changes.');
    },
  });

  const handleBackgroundUpload = async (file) => {
    setUploadingBackground(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await updateSettingsMutation.mutateAsync({
        background_image_url: file_url,
        logo_url: currentSettings.logo_url
      });
      toast.success('Background image updated!');
    } catch (error) {
      toast.error('Failed to upload background image');
    } finally {
      setUploadingBackground(false);
    }
  };

  const handleLogoUpload = async (file) => {
    setUploadingLogo(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await updateSettingsMutation.mutateAsync({
        background_image_url: currentSettings.background_image_url,
        logo_url: file_url
      });
      toast.success('Logo updated!');
    } catch (error) {
      toast.error('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleBackgroundUrlSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const url = formData.get('background_url');
    
    await updateSettingsMutation.mutateAsync({
      background_image_url: url,
      logo_url: currentSettings.logo_url
    });
  };

  const handleLogoUrlSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const url = formData.get('logo_url');
    
    await updateSettingsMutation.mutateAsync({
      background_image_url: currentSettings.background_image_url,
      logo_url: url
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Customize App</h1>
          <p className="text-gray-400">Change your app's background image and logo</p>
        </div>

        {/* Background Image */}
        <Card className="bg-white/5 backdrop-blur-sm border-green-500/20 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Palette className="w-5 h-5 text-green-400" />
              Background Image
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Current Background Preview */}
            <div>
              <Label className="text-gray-300 mb-2 block">Current Background</Label>
              <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-white/10">
                <img 
                  src={currentSettings.background_image_url} 
                  alt="Current background"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Upload New Background */}
            <div>
              <Label className="text-gray-300 mb-2 block">Upload New Background</Label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files[0] && handleBackgroundUpload(e.target.files[0])}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={uploadingBackground}
                />
                <Button
                  variant="outline"
                  disabled={uploadingBackground}
                  className="w-full border-green-500/50 text-green-400 hover:bg-green-500/10"
                >
                  {uploadingBackground ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Background Image
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Or Enter URL */}
            <div>
              <Label className="text-gray-300 mb-2 block">Or Enter Image URL</Label>
              <form onSubmit={handleBackgroundUrlSubmit} className="flex gap-2">
                <Input
                  name="background_url"
                  defaultValue={currentSettings.background_image_url}
                  placeholder="https://..."
                  className="bg-white/5 border-white/10 text-white flex-1"
                />
                <Button 
                  type="submit" 
                  disabled={updateSettingsMutation.isPending}
                  className="bg-gradient-to-r from-green-500 to-green-600"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Update
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        {/* Logo */}
        <Card className="bg-white/5 backdrop-blur-sm border-orange-500/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-orange-400" />
              Logo
            </CardTitle>
            <p className="text-sm text-gray-400 mt-2">
              This logo appears in the header and on invoices
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Current Logo Preview */}
            <div>
              <Label className="text-gray-300 mb-2 block">Current Logo</Label>
              <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-white/10 bg-white/5">
                <img 
                  src={currentSettings.logo_url} 
                  alt="Current logo"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Upload New Logo */}
            <div>
              <Label className="text-gray-300 mb-2 block">Upload New Logo</Label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files[0] && handleLogoUpload(e.target.files[0])}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={uploadingLogo}
                />
                <Button
                  variant="outline"
                  disabled={uploadingLogo}
                  className="w-full border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                >
                  {uploadingLogo ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Logo
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Square images work best (e.g., 512x512px)
              </p>
            </div>

            {/* Or Enter URL */}
            <div>
              <Label className="text-gray-300 mb-2 block">Or Enter Logo URL</Label>
              <form onSubmit={handleLogoUrlSubmit} className="flex gap-2">
                <Input
                  name="logo_url"
                  defaultValue={currentSettings.logo_url}
                  placeholder="https://..."
                  className="bg-white/5 border-white/10 text-white flex-1"
                />
                <Button 
                  type="submit" 
                  disabled={updateSettingsMutation.isPending}
                  className="bg-gradient-to-r from-orange-500 to-orange-600"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Update
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-blue-500/10 border-blue-500/20 mt-6">
          <CardContent className="py-4">
            <p className="text-sm text-blue-300 mb-2">💡 <strong>Tip:</strong> After updating, refresh the page to see changes throughout the app!</p>
            <p className="text-xs text-gray-400">The logo will also automatically appear on all future invoices.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
