import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Upload, Loader2, Music } from "lucide-react";

export default function SongForm({ song, onSubmit, onCancel, isSubmitting, nextOrder }) {
  const [formData, setFormData] = useState(song || {
    title: '',
    artist: '',
    category: 'main',
    order: nextOrder || 1,
    key: '',
    tempo: '',
    duration: '',
    notes: '',
    vocal_track_url: '',
    guitar_track_url: '',
    bass_track_url: '',
    drums_track_url: '',
    keys_track_url: ''
  });

  const [uploading, setUploading] = useState({});

  const handleFileUpload = async (trackType, file) => {
    if (!file) return;

    setUploading(prev => ({ ...prev, [trackType]: true }));

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, [`${trackType}_track_url`]: file_url }));
    } catch (error) {
      alert(`Error uploading ${trackType} track. Please try again.`);
    } finally {
      setUploading(prev => ({ ...prev, [trackType]: false }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      order: parseInt(formData.order)
    });
  };

  const tracks = [
    { key: 'vocal', label: 'Vocals', color: 'blue' },
    { key: 'guitar', label: 'Guitar', color: 'red' },
    { key: 'bass', label: 'Bass', color: 'purple' },
    { key: 'drums', label: 'Drums', color: 'orange' },
    { key: 'keys', label: 'Keys/Other', color: 'green' }
  ];

  return (
    <Card className="bg-white/5 backdrop-blur-sm border-green-500/20 mb-6">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          {song ? 'Edit Song' : 'Add New Song'}
          <Button variant="ghost" size="icon" onClick={onCancel} className="text-gray-400">
            <X className="w-5 h-5" />
          </Button>
        </CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          {/* Basic Info */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-gray-300">Song Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                className="bg-white/5 border-white/10 text-white"
                placeholder="Enter song title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="artist" className="text-gray-300">Original Artist *</Label>
              <Input
                id="artist"
                value={formData.artist}
                onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                required
                className="bg-white/5 border-white/10 text-white"
                placeholder="e.g. Led Zeppelin"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category" className="text-gray-300">Category *</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">Main Song</SelectItem>
                  <SelectItem value="popular_mainstream">Popular Mainstream</SelectItem>
                  <SelectItem value="classic_rock_muso">Classic Rock Muso</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="order" className="text-gray-300">Set List Position *</Label>
              <Input
                id="order"
                type="number"
                value={formData.order}
                onChange={(e) => setFormData({ ...formData, order: e.target.value })}
                required
                className="bg-white/5 border-white/10 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="key" className="text-gray-300">Key</Label>
              <Input
                id="key"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
                placeholder="e.g. A, Dm, C#"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tempo" className="text-gray-300">Tempo/BPM</Label>
              <Input
                id="tempo"
                value={formData.tempo}
                onChange={(e) => setFormData({ ...formData, tempo: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
                placeholder="e.g. 120 BPM"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration" className="text-gray-300">Duration</Label>
              <Input
                id="duration"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
                placeholder="e.g. 4:30"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-gray-300">Performance Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="bg-white/5 border-white/10 text-white h-24"
              placeholder="Add any notes about the song, arrangement, cues, etc."
            />
          </div>

          {/* Track Uploads */}
          <div className="border-t border-white/10 pt-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Music className="w-5 h-5 text-green-400" />
              Individual Track Stems (MP3)
            </h3>
            <p className="text-sm text-gray-400 mb-4">Upload individual instrument tracks for the multi-track mixer</p>

            <div className="grid md:grid-cols-2 gap-4">
              {tracks.map((track) => (
                <div key={track.key} className="space-y-2">
                  <Label className="text-gray-300">{track.label} Track</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById(`${track.key}-upload`).click()}
                      disabled={uploading[track.key]}
                      className={`flex-1 border-${track.color}-500/20 hover:bg-${track.color}-500/10`}
                    >
                      {uploading[track.key] ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : formData[`${track.key}_track_url`] ? (
                        <>
                          <Music className="w-4 h-4 mr-2 text-green-400" />
                          Uploaded
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload {track.label}
                        </>
                      )}
                    </Button>
                    {formData[`${track.key}_track_url`] && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFormData(prev => ({ ...prev, [`${track.key}_track_url`]: '' }))}
                        className="text-red-400 hover:text-red-300"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <input
                    id={`${track.key}-upload`}
                    type="file"
                    accept="audio/mpeg,audio/mp3"
                    onChange={(e) => handleFileUpload(track.key, e.target.files[0])}
                    className="hidden"
                  />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} className="border-white/10">
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-gradient-to-r from-green-500 to-green-600"
          >
            <Save className="w-4 h-4 mr-2" />
            {song ? 'Update' : 'Add'} Song
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}