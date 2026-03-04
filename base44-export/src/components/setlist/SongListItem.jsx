import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Music2, GripVertical } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";

export default function SongListItem({ song, index, onEdit, onDelete, isDeleting }) {
  const categoryColors = {
    main: "bg-blue-500/20 text-blue-400 border-blue-500/50",
    popular_mainstream: "bg-purple-500/20 text-purple-400 border-purple-500/50",
    classic_rock_muso: "bg-orange-500/20 text-orange-400 border-orange-500/50"
  };

  const categoryLabels = {
    main: "Main",
    popular_mainstream: "Popular",
    classic_rock_muso: "Classic Rock"
  };

  const hasAnyTrack = song.vocal_track_url || song.guitar_track_url || song.bass_track_url || song.drums_track_url || song.keys_track_url;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card className="bg-white/5 backdrop-blur-sm border-white/10 hover:border-green-500/50 transition-all">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-gray-500">
              <GripVertical className="w-5 h-5" />
              <span className="text-lg font-bold min-w-[30px]">{song.order}</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h3 className="font-semibold text-white text-lg truncate">{song.title}</h3>
                <Badge className={categoryColors[song.category]}>
                  {categoryLabels[song.category]}
                </Badge>
                {hasAnyTrack && (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
                    <Music2 className="w-3 h-3 mr-1" />
                    Mixer Ready
                  </Badge>
                )}
              </div>
              <p className="text-gray-400 text-sm">{song.artist}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                {song.key && <span>Key: {song.key}</span>}
                {song.tempo && <span>• {song.tempo}</span>}
                {song.duration && <span>• {song.duration}</span>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {hasAnyTrack && (
                <Link to={`${createPageUrl("SongMixer")}?id=${song.id}`}>
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                  >
                    <Music2 className="w-4 h-4 mr-2" />
                    Mixer
                  </Button>
                </Link>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(song)}
                className="text-gray-400 hover:text-white"
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(song.id)}
                disabled={isDeleting}
                className="text-gray-400 hover:text-red-400"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}