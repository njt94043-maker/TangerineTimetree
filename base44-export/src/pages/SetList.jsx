
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Music2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SongForm from "../components/setlist/SongForm";
import SongListItem from "../components/setlist/SongListItem";

export default function SetList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingSong, setEditingSong] = useState(null);

  // Removed auth check - app is now public

  const { data: songs = [], isLoading } = useQuery({
    queryKey: ['songs'],
    queryFn: () => base44.entities.Song.list('order'),
    initialData: [],
  });

  const createSongMutation = useMutation({
    mutationFn: (songData) => base44.entities.Song.create(songData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songs'] });
      setShowForm(false);
      setEditingSong(null);
    },
  });

  const updateSongMutation = useMutation({
    mutationFn: ({ id, songData }) => base44.entities.Song.update(id, songData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songs'] });
      setShowForm(false);
      setEditingSong(null);
    },
  });

  const deleteSongMutation = useMutation({
    mutationFn: (id) => base44.entities.Song.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songs'] });
    },
  });

  const handleSubmit = (songData) => {
    if (editingSong) {
      updateSongMutation.mutate({ id: editingSong.id, songData });
    } else {
      createSongMutation.mutate(songData);
    }
  };

  const handleEdit = (song) => {
    setEditingSong(song);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this song from the set list?')) {
      deleteSongMutation.mutate(id);
    }
  };

  const categoryCounts = {
    main: songs.filter(s => s.category === 'main').length,
    popular_mainstream: songs.filter(s => s.category === 'popular_mainstream').length,
    classic_rock_muso: songs.filter(s => s.category === 'classic_rock_muso').length
  };

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Set List</h1>
            <p className="text-gray-400">Manage your band's repertoire</p>
          </div>
          <Button
            onClick={() => {
              setEditingSong(null);
              setShowForm(true);
            }}
            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Song
          </Button>
        </div>

        {/* Category Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Main Songs</div>
            <div className="text-2xl font-bold text-white">{categoryCounts.main}</div>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Popular Mainstream</div>
            <div className="text-2xl font-bold text-white">{categoryCounts.popular_mainstream}</div>
          </div>
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Classic Rock Muso</div>
            <div className="text-2xl font-bold text-white">{categoryCounts.classic_rock_muso}</div>
          </div>
        </div>

        {showForm && (
          <SongForm
            song={editingSong}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingSong(null);
            }}
            isSubmitting={createSongMutation.isPending || updateSongMutation.isPending}
            nextOrder={songs.length > 0 ? Math.max(...songs.map(s => s.order || 0)) + 1 : 1}
          />
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Music2 className="w-8 h-8 text-green-500 animate-pulse" />
          </div>
        ) : songs.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-20 text-center">
            <Music2 className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 text-lg mb-2">No songs in set list yet</p>
            <p className="text-gray-500 text-sm">Add your first song to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {songs.map((song, index) => (
              <SongListItem
                key={song.id}
                song={song}
                index={index}
                onEdit={handleEdit}
                onDelete={handleDelete}
                isDeleting={deleteSongMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
