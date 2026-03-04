

import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Home, ImageIcon, VideoIcon, LayoutDashboard, Menu, X, User, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const { data: settings = [], isLoading: settingsLoading } = useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const data = await base44.entities.AppSettings.list();
      return data;
    },
    initialData: [],
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const currentSettings = settings.find(s => s.setting_key === 'main') || {};
  const logoUrl = currentSettings.logo_url || "https://scontent-lhr6-2.xx.fbcdn.net/v/t39.30808-6/567666137_122196871748318312_2444974931149722809_n.jpg?_nc_cat=105&ccb=1-7&_nc_sid=6ee11a&_nc_ohc=AZm2-beupR0Q7kNvwHoBIyN&_nc_oc=AdkO_zYzkDticI3IC9I7qLFWBCn7TJD1nfKb0JdRJGEGcAQ1YNuk-hzAEStExRT3BkpXwY4mBT9HgWeylfmVJc1&_nc_zt=23&_nc_ht=scontent-lhr6-2.xx&_nc_gid=u5gPfqxI-yDX-U926bKW8g&oh=00_AfddyIg81mFGf7BNXpsdCsPms5N5JMFBhy2cjRnX3VxvpQ&oe=6900F445";

  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (error) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const publicPages = [
    { name: "Home", url: createPageUrl("Home"), icon: Home },
    { name: "For Venues", url: createPageUrl("ForVenues"), icon: MapPin },
    { name: "Photos", url: createPageUrl("Photos"), icon: ImageIcon },
    { name: "Videos", url: createPageUrl("Videos"), icon: VideoIcon },
  ];

  const isActive = (url) => location.pathname === url;
  const isPublicPage = publicPages.some(page => isActive(page.url)) || location.pathname === '/';

  if (loading && !isPublicPage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Schema.org Structured Data for Local Business + Music Group */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": ["MusicGroup", "LocalBusiness"],
          "name": "The Green Tangerine",
          "description": "Live function band from the Rhondda, South Wales, bringing high-energy classic rock covers to pubs, weddings, and events across South Wales",
          "genre": ["Classic Rock", "Rock", "Indie"],
          "areaServed": [
            "Cardiff",
            "Swansea",
            "Bridgend",
            "Neath",
            "Rhondda",
            "Pontypridd",
            "Merthyr Tydfil",
            "Port Talbot",
            "South Wales"
          ],
          "address": {
            "@type": "PostalAddress",
            "addressRegion": "Rhondda Cynon Taf",
            "addressCountry": "GB"
          },
          "sameAs": [
            "https://www.facebook.com/profile.php?id=61559549376238",
            "https://www.tiktok.com/@thegreentangerine01"
          ],
          "email": "thegreentangerine01@gmail.com",
          "url": typeof window !== 'undefined' ? window.location.origin : '',
          "priceRange": "££"
        })}
      </script>

      <style>{`
        :root {
          --color-green: #10b981;
          --color-tangerine: #f97316;
          --color-dark: #111827;
        }
        
        * {
          -webkit-tap-highlight-color: transparent;
          box-sizing: border-box;
        }
        
        html, body {
          overflow-x: hidden;
          width: 100%;
          position: relative;
        }
        
        body {
          overscroll-behavior: none;
          touch-action: pan-y;
          -webkit-user-select: none;
          -webkit-touch-callout: none;
          -webkit-text-size-adjust: 100%;
        }
        
        input, textarea, select, button {
          font-size: 16px !important;
          -webkit-user-select: text;
        }
        
        @media (max-width: 768px) {
          * {
            max-width: 100vw;
          }
          
          img {
            max-width: 100%;
            height: auto;
          }
        }
        
        .min-h-screen {
          min-height: 100vh;
          min-height: -webkit-fill-available;
        }
      `}</style>
      
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />

      <header className="bg-black/30 backdrop-blur-md border-b border-green-500/20 sticky top-0 z-50">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 max-w-7xl mx-auto">
            <Link to={createPageUrl("Home")} className="flex items-center gap-3 group flex-shrink-0">
              <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 shadow-lg group-hover:shadow-green-500/50 transition-all">
                <img 
                  src={logoUrl}
                  alt="The Green Tangerine - Rhondda Function Band"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src = "https://scontent-lhr6-2.xx.fbcdn.net/v/t39.30808-6/567666137_122196871748318312_2444974931149722809_n.jpg?_nc_cat=105&ccb=1-7&_nc_sid=6ee11a&_nc_ohc=AZm2-beupR0Q7kNvwHoBIyN&_nc_oc=AdkO_zYzkDticI3IC9I7qLFWBCn7TJD1nfKb0JdRJGEGcAQ1YNuk-hzAEStExRT3BkpXwY4mBT9HgWeylfmVJc1&_nc_zt=23&_nc_ht=scontent-lhr6-2.xx&_nc_gid=u5gPfqxI-yDX-U926bKW8g&oh=00_AfddyIg81mFGf7BNXpsdCsPms5N5JMFBhy2cjRnX3VxvpQ&oe=6900F445";
                  }}
                />
              </div>
              <div className="block">
                <h1 className="text-lg sm:text-xl font-bold text-white group-hover:text-green-400 transition-colors whitespace-nowrap">
                  The Green Tangerine
                </h1>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {publicPages.map((page) => (
                <Link
                  key={page.name}
                  to={page.url}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all whitespace-nowrap ${
                    isActive(page.url)
                      ? "bg-green-500/20 text-green-400"
                      : "text-gray-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <page.icon className="w-4 h-4" />
                  {page.name}
                </Link>
              ))}
              
              <div className="w-px h-6 bg-gray-700 mx-2"></div>
              {!loading && (
                <>
                  <Button 
                    onClick={async () => {
                      if (user) {
                        window.location.href = createPageUrl("Dashboard");
                      } else {
                        await base44.auth.redirectToLogin(createPageUrl("Dashboard"));
                      }
                    }}
                    className={`bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 px-4 py-2 h-auto whitespace-nowrap ${
                      isActive(createPageUrl("Dashboard")) || 
                      isActive(createPageUrl("Bookings")) || 
                      isActive(createPageUrl("Availability")) ||
                      isActive(createPageUrl("ManagePhotos")) ||
                      isActive(createPageUrl("ManageVideos")) ||
                      isActive(createPageUrl("SetList")) ||
                      isActive(createPageUrl("SongMixer")) ||
                      isActive(createPageUrl("Files")) ||
                      isActive(createPageUrl("BandManagement"))
                        ? "ring-2 ring-orange-400"
                        : ""
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Band Dashboard
                  </Button>

                  {user && user.role === "admin" && (
                    <Link
                      to={createPageUrl("ManageUsers")}
                      className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all whitespace-nowrap ${
                        isActive(createPageUrl("ManageUsers"))
                          ? "bg-green-500/20 text-green-400"
                          : "text-gray-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <User className="w-4 h-4" />
                      Manage Users
                    </Link>
                  )}

                  {user && (
                    <Link to={createPageUrl("Profile")}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`text-gray-300 hover:text-white ${
                          isActive(createPageUrl("Profile")) ? "bg-white/10" : ""
                        }`}
                      >
                        <User className="w-5 h-5" />
                      </Button>
                    </Link>
                  )}
                </>
              )}
            </nav>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-white active:bg-white/20 min-h-[44px] min-w-[44px] flex-shrink-0"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-black/50 backdrop-blur-lg border-t border-green-500/20">
            <div className="px-4 py-4 space-y-1 max-h-[70vh] overflow-y-auto">
              {publicPages.map((page) => (
                <Link
                  key={page.name}
                  to={page.url}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all min-h-[44px] ${
                    isActive(page.url)
                      ? "bg-green-500/20 text-green-400"
                      : "text-gray-300 active:bg-white/10"
                  }`}
                >
                  <page.icon className="w-5 h-5 flex-shrink-0" />
                  {page.name}
                </Link>
              ))}
              
              {!loading && (
                <>
                  <div className="h-px bg-gray-700 my-2"></div>
                  <button
                    onClick={async () => {
                      setMobileMenuOpen(false);
                      if (user) {
                        window.location.href = createPageUrl("Dashboard");
                      } else {
                        await base44.auth.redirectToLogin(createPageUrl("Dashboard"));
                      }
                    }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all w-full text-left min-h-[44px] ${
                      isActive(createPageUrl("Dashboard")) ||
                      isActive(createPageUrl("Bookings")) || 
                      isActive(createPageUrl("Availability")) ||
                      isActive(createPageUrl("ManagePhotos")) ||
                      isActive(createPageUrl("ManageVideos")) ||
                      isActive(createPageUrl("SetList")) ||
                      isActive(createPageUrl("SongMixer")) ||
                      isActive(createPageUrl("Files")) ||
                      isActive(createPageUrl("BandManagement"))
                        ? "bg-orange-500/20 text-orange-400"
                        : "text-gray-300 active:bg-white/10"
                    }`}
                  >
                    <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
                    Band Dashboard
                  </button>

                  {user && user.role === "admin" && (
                    <Link
                      to={createPageUrl("ManageUsers")}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all min-h-[44px] ${
                        isActive(createPageUrl("ManageUsers"))
                          ? "bg-green-500/20 text-green-400"
                          : "text-gray-300 active:bg-white/10"
                      }`}
                    >
                      <User className="w-5 h-5 flex-shrink-0" />
                      Manage Users
                    </Link>
                  )}

                  {user && (
                    <Link
                      to={createPageUrl("Profile")}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all min-h-[44px] ${
                        isActive(createPageUrl("Profile"))
                          ? "bg-green-500/20 text-green-400"
                          : "text-gray-300 active:bg-white/10"
                      }`}
                    >
                      <User className="w-5 h-5 flex-shrink-0" />
                      My Profile
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="w-full">
        {children}
      </main>

      <footer className="bg-black/30 backdrop-blur-md border-t border-green-500/20 mt-20 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            {/* About */}
            <div>
              <h3 className="text-white font-bold text-lg mb-3">The Green Tangerine</h3>
              <p className="text-gray-400 text-sm mb-2">
                Live function band from the Rhondda, bringing high-energy classic rock covers to venues across South Wales.
              </p>
              <p className="text-gray-500 text-sm">
                Based in Rhondda Cynon Taf, South Wales
              </p>
            </div>

            {/* Areas We Cover */}
            <div>
              <h3 className="text-white font-bold text-lg mb-3">Areas We Cover</h3>
              <div className="text-gray-400 text-sm space-y-1">
                <p>Cardiff • Swansea • Bridgend</p>
                <p>Neath • Rhondda • Pontypridd</p>
                <p>Merthyr Tydfil • Port Talbot</p>
                <p className="text-green-400 mt-2">...and across South Wales</p>
              </div>
            </div>

            {/* Contact */}
            <div>
              <h3 className="text-white font-bold text-lg mb-3">Get In Touch</h3>
              <div className="text-gray-400 text-sm space-y-2">
                <p>
                  <a href="mailto:thegreentangerine01@gmail.com" className="hover:text-green-400 transition-colors">
                    thegreentangerine01@gmail.com
                  </a>
                </p>
                <p>
                  <a href="https://www.facebook.com/profile.php?id=61559549376238" target="_blank" rel="noopener noreferrer" className="hover:text-green-400 transition-colors">
                    Follow us on Facebook
                  </a>
                </p>
                <Link to={createPageUrl("Contact")} className="text-orange-400 hover:text-orange-300 transition-colors inline-block mt-2">
                  Book us for your venue →
                </Link>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6 text-center text-gray-400">
            <p className="text-sm">© 2024 The Green Tangerine. All rights reserved.</p>
            <p className="text-lg font-bold text-green-400 mt-2">Keep it Green!</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

