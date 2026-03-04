
import React, { useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, ExternalLink, Loader2, Shirt, Package } from "lucide-react";
import { motion } from "framer-motion";

export default function MerchShop() {
  useEffect(() => {
    document.title = "Merchandise | The Green Tangerine Band Shop";
    
    const metaDescription = document.querySelector('meta[name="description"]');
    const descriptionContent = 'Official merchandise from The Green Tangerine. T-shirts, hoodies and exclusive band gear. Show your support for South Wales\' premier function band.';
    
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
      { property: 'og:title', content: 'Band Merchandise | The Green Tangerine' },
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

    // Clean up function to remove dynamically added meta tags if the component unmounts
    return () => {
      // Revert title to a default or previous value if needed, or leave for global handling
      // document.title = "Default Title"; 

      // Remove dynamically added description meta tag
      if (!metaDescription && document.head.querySelector('meta[name="description"][content="' + descriptionContent + '"]')) {
        document.head.removeChild(document.head.querySelector('meta[name="description"][content="' + descriptionContent + '"]'));
      }

      // Remove dynamically added OG meta tags
      ogTags.forEach(tag => {
        const elementToRemove = document.head.querySelector(`meta[property="${tag.property}"]`);
        if (elementToRemove && elementToRemove.getAttribute('content') === tag.content) { // Only remove if it's the one we added
          document.head.removeChild(elementToRemove);
        }
      });
    };
  }, []);

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['app-settings'], // Corrected from keyQuery to queryKey if it was keyQuery in the outline
    queryFn: () => base44.entities.AppSettings.list(),
    initialData: [],
  });

  const merchSettings = settings.find(s => s.setting_key === 'merch_shop') || {};
  const shopUrl = merchSettings.shop_url;

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="mb-6">
              <Shirt className="w-20 h-20 text-green-400 mx-auto mb-4" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Band Merchandise</h1>
            <p className="text-xl text-gray-400 mb-8">Show your support with exclusive Green Tangerine gear</p>
          </motion.div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
          </div>
        ) : !shopUrl ? (
          <Card className="bg-white/5 backdrop-blur-sm border-green-500/20">
            <CardContent className="py-20 text-center">
              <ShoppingCart className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 text-lg mb-2">Merch shop coming soon!</p>
              <p className="text-gray-500 text-sm">Check back later for exclusive band merchandise</p>
            </CardContent>
          </Card>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Card className="bg-gradient-to-br from-green-500/20 to-orange-500/20 backdrop-blur-sm border-green-500/30 overflow-hidden">
              <CardContent className="py-16 text-center">
                <Package className="w-24 h-24 text-green-400 mx-auto mb-6" />
                <h2 className="text-2xl font-bold text-white mb-4">Visit Our Official Merch Store</h2>
                <p className="text-gray-300 mb-8 max-w-md mx-auto">
                  Browse our full collection of band merchandise, apparel, and exclusive items
                </p>
                
                <a href={shopUrl} target="_blank" rel="noopener noreferrer">
                  <Button 
                    size="lg"
                    className="bg-gradient-to-r from-green-500 to-orange-500 hover:from-green-600 hover:to-orange-600 text-white px-8 py-6 text-lg font-semibold shadow-lg"
                  >
                    <ExternalLink className="w-6 h-6 mr-3" />
                    Shop Now on Shopify
                  </Button>
                </a>

                <p className="text-sm text-gray-400 mt-6">
                  🔒 Secure checkout powered by Shopify
                </p>
              </CardContent>
            </Card>

            {/* Features */}
            <div className="grid md:grid-cols-3 gap-6 mt-8">
              <Card className="bg-white/5 backdrop-blur-sm border-white/10">
                <CardContent className="py-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                    <ShoppingCart className="w-6 h-6 text-green-400" />
                  </div>
                  <h3 className="text-white font-semibold mb-2">Official Merch</h3>
                  <p className="text-sm text-gray-400">Authentic band merchandise and apparel</p>
                </CardContent>
              </Card>

              <Card className="bg-white/5 backdrop-blur-sm border-white/10">
                <CardContent className="py-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-3">
                    <Package className="w-6 h-6 text-blue-400" />
                  </div>
                  <h3 className="text-white font-semibold mb-2">Fast Shipping</h3>
                  <p className="text-sm text-gray-400">Quick delivery to your door</p>
                </CardContent>
              </Card>

              <Card className="bg-white/5 backdrop-blur-sm border-white/10">
                <CardContent className="py-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-3">
                    <Shirt className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="text-white font-semibold mb-2">Quality Products</h3>
                  <p className="text-sm text-gray-400">High-quality materials and prints</p>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
