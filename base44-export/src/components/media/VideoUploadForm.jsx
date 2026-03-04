
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { X, Save, Upload, Loader2, Video as VideoIcon } from "lucide-react";

export default function VideoUploadForm({ video, onSubmit, onCancel, isSubmitting }) {
  const [formData, setFormData] = useState(video || {
    title: '',
    video_url: '',
    thumbnail_url: '',
    date_performed: '',
    venue: '',
    description: '',
    visible_to_public: true
  });
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleThumbnailSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('File is too large. Maximum size is 10MB.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    setSelectedFile(file);
    setUploading(true);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, thumbnail_url: file_url });
      
      // Create FileStorage record
      try {
        await base44.entities.FileStorage.create({
          file_name: file.name,
          file_url: file_url,
          file_type: 'image',
          file_size: file.size,
          category: 'videos',
          subcategory: 'promo',
          uploaded_by_email: 'system',
          uploaded_by_name: 'Band Admin',
          related_entity: 'Video',
          description: `Thumbnail for ${formData.title || 'video'}`,
          tags: ['video', 'thumbnail'],
          visible_to_all: formData.visible_to_public !== false
        });
      } catch (error) {
        console.warn('Could not create FileStorage record:', error);
      }
    } catch (error) {
      alert('Error uploading thumbnail. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.video_url) {
      alert('Please enter a video URL');
      return;
    }
    onSubmit(formData);
  };

  return (
    <Card className="bg-white/5 backdrop-blur-sm border-pink-500/20 mb-6">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <span className="text-lg sm:text-xl">{video ? 'Edit Video' : 'Add New Video'}</span>
          <Button variant="ghost" size="icon" onClick={onCancel} className="text-gray-400 min-h-[44px] min-w-[44px]">
            <X className="w-5 h-5" />
          </Button>
        </CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-gray-300">Video Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                className="bg-white/5 border-white/10 text-white h-12 text-base"
                placeholder="e.g., Smoke on the Water - Live"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="video_url" className="text-gray-300">Video URL * (YouTube, etc.)</Label>
              <Input
                id="video_url"
                type="url"
                value={formData.video_url}
                onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                required
                className="bg-white/5 border-white/10 text-white h-12 text-base"
                placeholder="https://youtube.com/..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="thumbnail" className="text-gray-300">Thumbnail (Optional)</Label>
              <div className="flex flex-col gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('thumbnail').click()}
                  disabled={uploading}
                  className="border-white/10 h-auto min-h-[44px] text-base w-full"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : formData.thumbnail_url ? (
                    <>
                      <VideoIcon className="w-5 h-5 mr-2 text-green-400" />
                      Change Thumbnail
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 mr-2" />
                      Choose Thumbnail
                    </>
                  )}
                </Button>
                {selectedFile && (
                  <span className="text-sm text-gray-400 truncate px-2">{selectedFile.name}</span>
                )}
              </div>
              <input
                id="thumbnail"
                type="file"
                accept="image/*"
                onChange={handleThumbnailSelect}
                className="hidden"
              />
              {formData.thumbnail_url && (
                <div className="mt-4">
                  <img
                    src={formData.thumbnail_url}
                    alt="Thumbnail preview"
                    className="w-full max-w-md h-32 object-cover rounded-lg mx-auto"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_performed" className="text-gray-300">Performance Date</Label>
              <Input
                id="date_performed"
                type="date"
                value={formData.date_performed}
                onChange={(e) => setFormData({ ...formData, date_performed: e.target.value })}
                className="bg-white/5 border-white/10 text-white h-12 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="venue" className="text-gray-300">Venue</Label>
              <Input
                id="venue"
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                className="bg-white/5 border-white/10 text-white h-12 text-base"
                placeholder="Where was this performed?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-gray-300">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-white/5 border-white/10 text-white min-h-[100px] text-base"
                placeholder="Add details about this performance..."
              />
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-pink-500/10 rounded-lg border border-pink-500/20 active:bg-pink-500/20 transition-colors">
            <input
              type="checkbox"
              id="visible_to_public"
              checked={formData.visible_to_public !== false}
              onChange={(e) => setFormData({ ...formData, visible_to_public: e.target.checked })}
              className="w-6 h-6 mt-0.5 rounded border-white/20 text-pink-600 focus:ring-pink-500 flex-shrink-0"
            />
            <Label htmlFor="visible_to_public" className="text-gray-300 cursor-pointer flex-1">
              <span className="font-semibold block">Display in Public Gallery</span>
              <p className="text-sm text-gray-400 mt-1">When checked, this video will be visible to fans on the Videos page</p>
            </Label>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} className="border-white/10 w-full sm:w-auto min-h-[44px] text-base">
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || uploading}
            className="bg-gradient-to-r from-pink-500 to-pink-600 w-full sm:w-auto min-h-[44px] text-base"
          >
            <Save className="w-5 h-5 mr-2" />
            {video ? 'Update' : 'Add'} Video
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
