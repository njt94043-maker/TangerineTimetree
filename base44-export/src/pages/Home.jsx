
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Calendar, Music, ImageIcon, Facebook, Mail, Download, X, PoundSterling } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, isAfter } from "date-fns";

export default function Home() {
  // Add SEO meta tags
  useEffect(() => {
    document.title = "The Green Tangerine | South Wales Function Band from the Rhondda";
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Energetic live band from the Rhondda bringing classic rock and indie covers to pubs, weddings, and events across Cardiff, Swansea, Bridgend, Neath, and South Wales.');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = 'Energetic live band from the Rhondda bringing classic rock and indie covers to pubs, weddings, and events across Cardiff, Swansea, Bridgend, Neath, and South Wales.';
      document.head.appendChild(meta);
    }

    // Open Graph tags for social sharing
    const ogTags = [
      { property: 'og:title', content: 'The Green Tangerine | South Wales Function Band' },
      { property: 'og:description', content: 'Live rock covers for pubs, weddings & events across Cardiff, Swansea, Bridgend, Neath & the Rhondda' },
      { property: 'og:type', content: 'website' },
      { property: 'og:image', content: 'https://scontent-lhr6-2.xx.fbcdn.net/v/t39.30808-6/567666137_122196871748318312_2444974931149722809_n.jpg' }
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

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  const { data: allGigs = [] } = useQuery({
    queryKey: ['public-gigs'],
    queryFn: () => base44.entities.Gig.list('date'),
    initialData: [],
  });

  // IMPORTANT: App customization settings - DO NOT MODIFY this query logic
  const { data: settings = [], isLoading: settingsLoading } = useQuery({
    queryKey: ['app-settings'],
    queryFn: () => base44.entities.AppSettings.list(),
    initialData: [],
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });

  // IMPORTANT: Find the main settings record - DO NOT MODIFY
  const currentSettings = settings.find(s => s.setting_key === 'main') || {};
  
  // IMPORTANT: Background image URL from database or fallback - DO NOT MODIFY
  // This ensures the custom background persists across all pages and devices
  const backgroundImage = currentSettings.background_image_url || "https://scontent-lhr6-2.xx.fbcdn.net/v/t39.30808-6/518178779_122184618356318312_5797258311142432207_n.jpg?_nc_cat=105&ccb=1-7&_nc_sid=833d8c&_nc_ohc=rlt6b9CaUu8Q7kNvwG6g45-&_nc_oc=Adk62vL7XSa8pOejztLrwyMGZ54etI8HxQLjqLWsPrSjpFdVfg1UdGuCj_TYdbv8sQjp1f0m5ZoGJRIzoEHBj&_nc_zt=23&_nc_ht=scontent-lhr6-2.xx&_nc_gid=Qz1XBFQRdYGnGnN7LAY-A&oh=00_AfeX6yRb3zAb5H8cMut-vPc8OHh93Jnjs8hY5mMxPXVw&oe=69010C4E";

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Only show if not already installed
      if (!window.matchMedia('(display-mode: standalone)').matches && !navigator.standalone) {
        setShowInstallPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      setShowInstallPrompt(false);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      setShowInstallPrompt(false);
    }
    
    setDeferredPrompt(null);
  };

  const today = new Date();
  const upcomingGigs = allGigs
    .filter(gig => gig.visible_to_public === true && isAfter(new Date(gig.date), today))
    .slice(0, 5);

  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      {/* Install App Prompt */}
      <AnimatePresence>
        {showInstallPrompt && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4"
          >
            <div className="bg-gradient-to-r from-green-500/90 to-orange-500/90 backdrop-blur-md rounded-lg shadow-lg p-3 flex items-center gap-3">
              <Download className="w-5 h-5 text-white flex-shrink-0" />
              <div className="flex-1">
                <p className="text-white text-sm font-medium">Install The Green Tangerine</p>
                <p className="text-white/80 text-xs">Quick access from your home screen</p>
              </div>
              <Button
                size="sm"
                onClick={handleInstallClick}
                className="bg-white text-green-600 hover:bg-gray-100 h-8 px-3 text-xs font-semibold"
              >
                Install
              </Button>
              <button
                onClick={() => setShowInstallPrompt(false)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section with Background Image */}
      <section className="relative overflow-hidden w-full min-h-screen">
        {/* Background Image */}
        <div className="absolute inset-0 w-full h-full">
          <div 
            className="w-full h-full bg-cover bg-center"
            style={{ 
              backgroundImage: `url(${backgroundImage})`,
              backgroundColor: '#1f2937' // Fallback color while loading
            }}
          />
          {/* Dark overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-gray-900/90"></div>
        </div>
        
        <div className="relative w-full px-4 sm:px-6 lg:px-8 py-20 md:py-32 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black mb-6 uppercase tracking-wider" style={{
              color: '#10b981',
              textShadow: '3px 3px 0px #f97316, -2px -2px 0px #047857, 0px 0px 20px #10b98180, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
              fontFamily: 'Impact, "Arial Black", sans-serif',
              letterSpacing: '0.05em',
              wordBreak: 'break-word'
            }}>
              The Green Tangerine
            </h1>
            <p className="text-2xl sm:text-3xl md:text-4xl font-black text-white mb-4 uppercase tracking-wide" style={{
              textShadow: '2px 2px 0px #10b981, -2px -2px 0px #f97316, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
              fontFamily: 'Impact, "Arial Black", sans-serif',
              letterSpacing: '0.08em'
            }}>
              South Wales Function Band
            </p>
            <p className="text-lg sm:text-xl md:text-2xl text-gray-200 mb-6 max-w-4xl mx-auto drop-shadow-lg">
              Live rock covers for pubs, weddings & events across Cardiff, Swansea, Bridgend, Neath & the Rhondda
            </p>
            <p className="text-xl sm:text-2xl font-bold text-green-400 mb-8 drop-shadow-lg">Keep It Green</p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              <Link to={createPageUrl("Photos")}>
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-2 border-green-500 text-green-400 hover:bg-green-500/10 px-8 py-6 text-lg bg-black/30 backdrop-blur-sm shadow-lg">
                  <ImageIcon className="w-5 h-5 mr-2" />
                  View Photos
                </Button>
              </Link>
              <Link to={createPageUrl("Videos")}>
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-2 border-orange-500 text-orange-400 hover:bg-orange-500/10 px-8 py-6 text-lg bg-black/30 backdrop-blur-sm shadow-lg">
                  <Music className="w-5 h-5 mr-2" />
                  Watch Videos
                </Button>
              </Link>
            </div>

            <a 
              href="https://www.facebook.com/profile.php?id=61559549376238" 
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-3 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-lg border-2 border-blue-500 hover:border-blue-400 font-semibold"
            >
              <Facebook className="w-5 h-5" fill="currentColor" />
              Follow us on Facebook
            </a>

            <a 
              href="https://www.tiktok.com/@thegreentangerine01?_t=ZN-90otVkOxmg2&_r=1" 
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-3 px-6 py-3 bg-black hover:bg-gray-900 text-white rounded-lg transition-all shadow-lg border-2 border-pink-500 hover:border-cyan-400 font-semibold mt-4"
            >
              <Music className="w-5 h-5" />
              Follow us on TikTok
            </a>
          </motion.div>
        </div>
      </section>

      {/* Upcoming Gigs Section */}
      {upcomingGigs.length > 0 && (
        <section className="py-20 bg-black/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl font-bold text-white mb-8 text-center">Upcoming Gigs</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {upcomingGigs.map((gig, index) => (
                  <motion.div
                    key={gig.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-green-500/20 hover:border-green-500/50 transition-all"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white mb-2">{gig.title}</h3>
                        <p className="text-green-400 font-medium">{gig.venue}</p>
                      </div>
                      <Calendar className="w-6 h-6 text-orange-500" />
                    </div>
                    <div className="space-y-2 text-gray-400">
                      <p className="text-lg font-semibold text-white">
                        {format(new Date(gig.date), 'EEEE, MMMM d, yyyy')}
                      </p>
                      {gig.time && <p>Time: {gig.time}</p>}
                      {gig.address && <p className="text-sm">{gig.address}</p>}
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="mt-12 text-center">
                <Link to={createPageUrl("Gigs")}>
                  <Button size="lg" className="bg-gradient-to-r from-green-500 to-orange-500 hover:from-green-600 hover:to-orange-600 text-white px-8 py-6 text-lg">
                    <Calendar className="w-5 h-5 mr-2" />
                    View All Gigs
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* About Section */}
      <section className="py-20 bg-black/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold text-white mb-6">About The Band</h2>
            <p className="text-lg text-gray-300 leading-relaxed mb-6">
              The Green Tangerine is a tribute to classic rock, bringing you revamped high energy rock classics 
              guaranteed to get the hips swinging. From Led Zeppelin to The Rolling Stones, from Pink Floyd to The Red Hot Chilli Peppers, 
              we cover all the legends with authenticity and passion.
            </p>
            <p className="text-xl text-orange-400 font-semibold mb-6">
              We don't just play - we display!
            </p>
            <p className="text-gray-400 mb-6">
              Based in the Rhondda, performing at venues across South Wales including Cardiff, Swansea, Bridgend, Neath, Pontypridd, and beyond. 
              Whether it's a pub gig, wedding, corporate event, or festival, we deliver unforgettable performances.
            </p>
            <Link to={createPageUrl("ForVenues")}>
              <Button className="bg-gradient-to-r from-green-500 to-orange-500 hover:from-green-600 hover:to-orange-600">
                Book Us for Your Venue
              </Button>
            </Link>
            <div className="mt-8">
              <p className="text-green-400 font-bold text-2xl">100% Recommended</p>
              <p className="text-gray-400 text-sm">Based on 8 reviews</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pricing CTA */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="bg-gradient-to-r from-green-500/20 to-orange-500/20 rounded-2xl p-8 border border-green-500/30"
          >
            <h2 className="text-3xl font-bold text-white mb-4">Our Pricing</h2>
            <p className="text-gray-300 mb-6">
              Transparent pricing for quality entertainment. See our rates and packages.
            </p>
            <Link to={createPageUrl("Pricing")}>
              <Button size="lg" className="bg-gradient-to-r from-green-500 to-orange-500 hover:from-green-600 hover:to-orange-600 text-white px-8 py-6 text-lg">
                <PoundSterling className="w-5 h-5 mr-2" />
                View Pricing
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Merch Shop CTA */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="bg-gradient-to-r from-green-500/20 to-orange-500/20 rounded-2xl p-8 border border-green-500/30"
          >
            <h2 className="text-3xl font-bold text-white mb-4">Band Merchandise</h2>
            <p className="text-gray-300 mb-6">
              Check out our exclusive band themed merchandise. Show your support in style!
            </p>
            <Link to={createPageUrl("MerchShop")}>
              <Button size="lg" className="bg-gradient-to-r from-green-500 to-orange-500 hover:from-green-600 hover:to-orange-600 text-white px-8 py-6 text-lg">
                <Music className="w-5 h-5 mr-2" />
                Visit Merch Shop
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="bg-gradient-to-r from-green-500/20 to-orange-500/20 rounded-2xl p-8 border border-green-500/30"
          >
            <h2 className="text-3xl font-bold text-white mb-4">Book The Green Tangerine</h2>
            <p className="text-gray-300 mb-6">
              Interested in booking us for your venue or event in Cardiff, Swansea, Bridgend, or anywhere across South Wales? Get in touch!
            </p>
            <Link to={createPageUrl("Contact")}>
              <Button size="lg" className="bg-gradient-to-r from-green-500 to-orange-500 hover:from-green-600 hover:to-orange-600 text-white px-8 py-6 text-lg">
                <Mail className="w-5 h-5 mr-2" />
                Contact Us
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
