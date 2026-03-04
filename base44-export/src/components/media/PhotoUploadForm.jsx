
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X, Save, Upload, Loader2, Image as ImageIcon } from "lucide-react";

export default function PhotoUploadForm({ photo, onSubmit, onCancel, isSubmitting }) {
  const [formData, setFormData] = useState(photo || {
    title: '',
    image_url: '',
    date_taken: '',
    location: '',
    visible_to_public: true
  });
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File is too large. Maximum size is 10MB.');
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    setSelectedFile(file);
    setUploading(true);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, image_url: file_url });
      
      // Create FileStorage record
      try {
        await base44.entities.FileStorage.create({
          file_name: file.name,
          file_url: file_url,
          file_type: 'image',
          file_size: file.size,
          category: 'photos',
          subcategory: 'live_performance',
          uploaded_by_email: 'system', // We don't have user context here
          uploaded_by_name: 'Band Admin',
          related_entity: 'Photo',
          description: formData.title || 'Band photo',
          tags: ['photo'],
          visible_to_all: formData.visible_to_public !== false
        });
      } catch (error) {
        console.warn('Could not create FileStorage record:', error);
      }
    } catch (error) {
      alert('Error uploading file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.image_url) {
      alert('Please upload an image first');
      return;
    }
    onSubmit(formData);
  };

  return (
    <Card className="bg-white/5 backdrop-blur-sm border-blue-500/20 mb-6">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <span className="text-lg sm:text-xl">{photo ? 'Edit Photo' : 'Upload New Photo'}</span>
          <Button variant="ghost" size="icon" onClick={onCancel} className="text-gray-400 min-h-[44px] min-w-[44px]">
            <X className="w-5 h-5" />
          </Button>
        </CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="photo-file" className="text-gray-300">Photo Image *</Label>
            <div className="flex flex-col gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('photo-file').click()}
                disabled={uploading}
                className="border-white/10 h-auto min-h-[44px] text-base w-full"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : formData.image_url ? (
                  <>
                    <ImageIcon className="w-5 h-5 mr-2 text-green-400" />
                    Change Image
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 mr-2" />
                    Choose Image
                  </>
                )}
              </Button>
              {selectedFile && (
                <span className="text-sm text-gray-400 truncate px-2">{selectedFile.name}</span>
              )}
            </div>
            <input
              id="photo-file"
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            {formData.image_url && (
              <div className="mt-4">
                <img
                  src={formData.image_url}
                  alt="Preview"
                  className="w-full max-w-md h-48 object-cover rounded-lg mx-auto"
                />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-gray-300">Photo Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                className="bg-white/5 border-white/10 text-white h-12 text-base"
                placeholder="e.g., Live at The Crown"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_taken" className="text-gray-300">Date Taken</Label>
              <Input
                id="date_taken"
                type="date"
                value={formData.date_taken}
                onChange={(e) => setFormData({ ...formData, date_taken: e.target.value })}
                className="bg-white/5 border-white/10 text-white h-12 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" className="text-gray-300">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="bg-white/5 border-white/10 text-white h-12 text-base"
                placeholder="Where was this photo taken?"
              />
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-blue-500/10 rounded-lg border border-blue-500/20 active:bg-blue-500/20 transition-colors">
            <input
              type="checkbox"
              id="visible_to_public"
              checked={formData.visible_to_public !== false}
              onChange={(e) => setFormData({ ...formData, visible_to_public: e.target.checked })}
              className="w-6 h-6 mt-0.5 rounded border-white/20 text-blue-600 focus:ring-blue-500 flex-shrink-0"
            />
            <Label htmlFor="visible_to_public" className="text-gray-300 cursor-pointer flex-1">
              <span className="font-semibold block">Display in Public Gallery</span>
              <p className="text-sm text-gray-400 mt-1">When checked, this photo will be visible to fans on the Photos page</p>
            </Label>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} className="border-white/10 w-full sm:w-auto min-h-[44px] text-base">
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || uploading || !formData.image_url}
            className="bg-gradient-to-r from-blue-500 to-blue-600 w-full sm:w-auto min-h-[44px] text-base"
          >
            <Save className="w-5 h-5 mr-2" />
            {photo ? 'Update' : 'Upload'} Photo
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
