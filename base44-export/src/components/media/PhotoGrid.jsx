
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Calendar, MapPin } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

export default function PhotoGrid({ photos, onEdit, onDelete, isDeleting }) {
  if (photos.length === 0) {
    return (
      <Card className="bg-white/5 backdrop-blur-sm border-blue-500/20">
        <CardContent className="py-20 text-center">
          <p className="text-gray-400 text-lg mb-2">No photos yet</p>
          <p className="text-gray-500 text-sm">Upload your first photo to get started</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {photos.map((photo, index) => (
        <motion.div
          key={photo.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
        >
          <Card className="bg-white/5 backdrop-blur-sm border-blue-500/20 hover:border-blue-500/50 transition-all overflow-hidden group">
            <div className="aspect-video relative overflow-hidden">
              <img
                src={photo.image_url}
                alt={photo.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={() => onEdit(photo)}
                  className="bg-white/90 hover:bg-white"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="destructive"
                  onClick={() => onDelete(photo.id)}
                  disabled={isDeleting}
                  className="bg-red-500/90 hover:bg-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <CardContent className="p-4">
              <h3 className="font-semibold text-white mb-2">{photo.title}</h3>
              <div className="space-y-1 text-sm text-gray-400">
                {photo.date_taken && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(photo.date_taken), 'MMM d, yyyy')}
                  </div>
                )}
                {photo.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3 h-3" />
                    {photo.location}
                  </div>
                )}
              </div>
              <Badge className={`mt-2 ${photo.visible_to_public !== false ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}`}>
                {photo.visible_to_public !== false ? 'Public Gallery' : 'Private (Band Only)'}
              </Badge>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
