
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, MapPin } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";

export default function Photos() {
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  useEffect(() => {
    document.title = "Photos | The Green Tangerine - South Wales Function Band";
    
    const metaDescription = document.querySelector('meta[name="description"]');
    const descriptionContent = 'View photos from The Green Tangerine live performances across Cardiff, Swansea, Bridgend, Neath and South Wales. Professional function band for pubs, weddings and events.';
    
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
      { property: 'og:title', content: 'Photos | The Green Tangerine - South Wales Function Band' },
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

  const { data: allPhotos, isLoading } = useQuery({
    queryKey: ['photos'],
    queryFn: () => base44.entities.Photo.list('-date_taken'),
    initialData: [],
  });

  // Filter to only show public photos
  const photos = allPhotos.filter(photo => photo.visible_to_public !== false);

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Photo Gallery</h1>
          <p className="text-xl text-gray-400">Moments captured from our journey</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array(8).fill(0).map((_, i) => (
              <div key={i} className="aspect-square bg-white/5 rounded-lg animate-pulse"></div>
            ))}
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">No photos yet. Check back soon!</p>
          </div>
        ) : (
          <motion.div 
            layout
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          >
            {photos.map((photo, index) => (
              <motion.div
                key={photo.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="aspect-square cursor-pointer group overflow-hidden rounded-lg relative"
                onClick={() => setSelectedPhoto(photo)}
              >
                <img
                  src={photo.image_url}
                  alt={photo.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                  <p className="text-white font-medium text-sm">{photo.title}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
            onClick={() => setSelectedPhoto(null)}
          >
            <button
              className="absolute top-4 right-4 text-white hover:text-green-400 transition-colors"
              onClick={() => setSelectedPhoto(null)}
            >
              <X className="w-8 h-8" />
            </button>

            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="max-w-5xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={selectedPhoto.image_url}
                alt={selectedPhoto.title}
                className="w-full h-auto rounded-lg shadow-2xl"
              />
              <div className="mt-6 text-center">
                <h3 className="text-2xl font-bold text-white mb-2">{selectedPhoto.title}</h3>
                <div className="flex items-center justify-center gap-4 text-gray-400">
                  {selectedPhoto.date_taken && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(selectedPhoto.date_taken), 'MMM d, yyyy')}
                    </div>
                  )}
                  {selectedPhoto.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {selectedPhoto.location}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
