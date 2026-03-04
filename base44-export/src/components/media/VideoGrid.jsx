
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Calendar, MapPin } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

export default function VideoGrid({ videos, onEdit, onDelete, isDeleting }) {
  const getYouTubeEmbedUrl = (url) => {
    const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
  };

  if (videos.length === 0) {
    return (
      <Card className="bg-white/5 backdrop-blur-sm border-pink-500/20">
        <CardContent className="py-20 text-center">
          <p className="text-gray-400 text-lg mb-2">No videos yet</p>
          <p className="text-gray-500 text-sm">Add your first video to get started</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {videos.map((video, index) => (
        <motion.div
          key={video.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
        >
          <Card className="bg-white/5 backdrop-blur-sm border-pink-500/20 hover:border-pink-500/50 transition-all overflow-hidden group">
            <div className="aspect-video relative overflow-hidden">
              {video.video_url.includes('youtube') || video.video_url.includes('youtu.be') ? (
                <iframe
                  src={getYouTubeEmbedUrl(video.video_url)}
                  title={video.title}
                  className="w-full h-full"
                  allowFullScreen
                ></iframe>
              ) : video.thumbnail_url ? (
                <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center">
                  <p className="text-gray-400">Video</p>
                </div>
              )}
              <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={() => onEdit(video)}
                  className="bg-white/90 hover:bg-white"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="destructive"
                  onClick={() => onDelete(video.id)}
                  disabled={isDeleting}
                  className="bg-red-500/90 hover:bg-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <CardContent className="p-4">
              <h3 className="font-semibold text-white mb-2">{video.title}</h3>
              {video.description && (
                <p className="text-sm text-gray-400 mb-2">{video.description}</p>
              )}
              <div className="space-y-1 text-sm text-gray-400">
                {video.date_performed && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(video.date_performed), 'MMM d, yyyy')}
                  </div>
                )}
                {video.venue && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3 h-3" />
                    {video.venue}
                  </div>
                )}
              </div>
              <Badge className={`mt-2 ${video.visible_to_public !== false ? 'bg-pink-500/20 text-pink-400' : 'bg-gray-500/20 text-gray-400'}`}>
                {video.visible_to_public !== false ? 'Public Gallery' : 'Private (Band Only)'}
              </Badge>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
