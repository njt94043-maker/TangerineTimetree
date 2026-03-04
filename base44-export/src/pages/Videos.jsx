
import React, { useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Calendar, MapPin, Play } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom"; // Added from outline
import { createPageUrl } from "@/utils"; // Added from outline
import { Button } from "@/components/ui/button"; // Added from outline

export default function Videos() {
  useEffect(() => {
    document.title = "Videos | The Green Tangerine - South Wales Function Band";
    
    const metaDescription = document.querySelector('meta[name="description"]');
    const descriptionContent = 'Watch The Green Tangerine live performances from venues across Cardiff, Swansea, Bridgend and South Wales. High-energy classic rock covers for pubs, weddings and events.';
    
    if (metaDescription) {
      metaDescription.setAttribute('content', descriptionContent);
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = descriptionContent;
      document.head.appendChild(meta);
    }

    // Open Graph tags
    const ogTags = [
      { property: 'og:title', content: 'Videos | The Green Tangerine - South Wales Function Band' },
      { property: 'og:description', content: descriptionContent },
      { property: 'og:type', content: 'website' },
      { property: 'og:image', content: 'https://scontent-lhr6-2.xx.fbcdn.net/v/t39.30808-6/567666137_122196871748318312_2444974931149722809_n.jpg' },
      { property: 'og:url', content: typeof window !== 'undefined' ? window.location.href : '' }
    ];

    ogTags.forEach(tag => {
      let element = document.querySelector(`meta[property="${tag.property}"]`);
      if (element) {
        element.setAttribute('content', tag.content);
      } else {
        element = document.createElement('meta');
        element.setAttribute('property', tag.property);
        element.setAttribute('content', tag.content);
        document.head.appendChild(element);
      }
    });
  }, []);

  const { data: allVideos, isLoading } = useQuery({
    queryKey: ['videos'],
    queryFn: () => base44.entities.Video.list('-date_performed'),
    initialData: [],
  });

  // Filter to only show public videos
  const videos = allVideos.filter(video => video.visible_to_public !== false);

  const getYouTubeEmbedUrl = (url) => {
    const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
  };

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Video Gallery</h1>
          <p className="text-xl text-gray-400">Watch our live performances</p>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="aspect-video bg-white/5 rounded-lg animate-pulse"></div>
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">No videos yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {videos.map((video, index) => (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="bg-white/5 backdrop-blur-sm rounded-lg overflow-hidden border border-green-500/20 hover:border-green-500/50 transition-all group"
              >
                {video.video_url.includes('youtube') || video.video_url.includes('youtu.be') ? (
                  <div className="aspect-video relative">
                    <iframe
                      src={getYouTubeEmbedUrl(video.video_url)}
                      title={video.title}
                      className="w-full h-full"
                      allowFullScreen
                    ></iframe>
                  </div>
                ) : video.thumbnail_url ? (
                  <div className="aspect-video relative">
                    <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors">
                      <Play className="w-16 h-16 text-white opacity-80" />
                    </div>
                  </div>
                ) : (
                  <div className="aspect-video bg-gradient-to-br from-green-500/20 to-orange-500/20 flex items-center justify-center">
                    <Play className="w-16 h-16 text-white opacity-50" />
                  </div>
                )}

                <div className="p-6">
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-green-400 transition-colors">
                    {video.title}
                  </h3>
                  {video.description && (
                    <p className="text-gray-400 text-sm mb-4">{video.description}</p>
                  )}
                  <div className="space-y-2">
                    {video.date_performed && (
                      <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(video.date_performed), 'MMM d, yyyy')}
                      </div>
                    )}
                    {video.venue && (
                      <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <MapPin className="w-4 h-4" />
                        {video.venue}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
