
import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Upload, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import PhotoUploadForm from "../components/media/PhotoUploadForm";
import PhotoGrid from "../components/media/PhotoGrid";

export default function ManagePhotos() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState(null);

  // Removed auth check - app is now public

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['photos'],
    queryFn: () => base44.entities.Photo.list('-created_date'),
    initialData: [],
  });

  const createPhotoMutation = useMutation({
    mutationFn: (photoData) => base44.entities.Photo.create(photoData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
      setShowUploadForm(false);
      setEditingPhoto(null);
    },
  });

  const updatePhotoMutation = useMutation({
    mutationFn: ({ id, photoData }) => base44.entities.Photo.update(id, photoData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
      setShowUploadForm(false);
      setEditingPhoto(null);
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: (id) => base44.entities.Photo.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    },
  });

  const handleSubmit = (photoData) => {
    if (editingPhoto) {
      updatePhotoMutation.mutate({ id: editingPhoto.id, photoData });
    } else {
      createPhotoMutation.mutate(photoData);
    }
  };

  const handleEdit = (photo) => {
    setEditingPhoto(photo);
    setShowUploadForm(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this photo? It will be removed from the public gallery.')) {
      deletePhotoMutation.mutate(id);
    }
  };

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Manage Photos</h1>
            <p className="text-gray-400">Upload and manage photos for the public gallery</p>
          </div>
          <Button
            onClick={() => {
              setEditingPhoto(null);
              setShowUploadForm(true);
            }}
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            Upload Photo
          </Button>
        </div>

        {showUploadForm && (
          <PhotoUploadForm
            photo={editingPhoto}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowUploadForm(false);
              setEditingPhoto(null);
            }}
            isSubmitting={createPhotoMutation.isPending || updatePhotoMutation.isPending}
          />
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : (
          <PhotoGrid
            photos={photos}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isDeleting={deletePhotoMutation.isPending}
          />
        )}
      </div>
    </div>
  );
}
