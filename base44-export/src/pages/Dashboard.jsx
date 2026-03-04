
import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, PoundSterling, Users, Music, FileText, ArrowRight, ChevronRight, ImageIcon, VideoIcon, Sparkles, X, Mic, Plus, Building2, AlertCircle, TrendingUp } from "lucide-react";
import { format, isAfter, isBefore } from "date-fns";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import UnifiedQuickInput from "../components/unified/UnifiedQuickInput";
import UnifiedVoiceInput from "../components/unified/UnifiedVoiceInput";
import MiniCalendar from "../components/calendar/MiniCalendar";
import MissingInfoChecker from "../components/dashboard/MissingInfoChecker";
import AddressUpdater from "../components/bookings/AddressUpdater";
import PaymentReminder from "../components/bookings/PaymentReminder";
import BulkInvoiceGenerator from "../components/bookings/BulkInvoiceGenerator";
import SessionPaymentTracker from "../components/expenses/SessionPaymentTracker";
import RetroactiveRecordGenerator from "../components/bookings/RetroactiveRecordGenerator";
import DeepTestAnalyzer from "../components/bookings/DeepTestAnalyzer";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [showQuickInput, setShowQuickInput] = useState(false);
  const [showVoiceInput, setShowVoiceInput] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (error) {
        // If authentication fails (e.g., no active session),
        // set user to null but do not redirect to login, as the app is public.
        // The dashboard will render without user-specific features.
        setUser(null);
      }
    };
    loadUser();
  }, []);

  const { data: gigs = [] } = useQuery({
    queryKey: ['gigs'],
    queryFn: () => base44.entities.Gig.list('-date'),
    initialData: [],
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => base44.entities.Booking.list('-event_date'),
    initialData: [],
  });

  const { data: unavailability = [] } = useQuery({
    queryKey: ['unavailability'],
    queryFn: () => base44.entities.Unavailability.list('-start_date'),
    initialData: [],
  });

  const { data: photos = [] } = useQuery({
    queryKey: ['photos'],
    queryFn: () => base44.entities.Photo.list('-created_date'),
    initialData: [],
  });

  const { data: videos = [] } = useQuery({
    queryKey: ['videos'],
    queryFn: () => base44.entities.Video.list('-created_date'),
    initialData: [],
  });

  const { data: bandIncomeRecords = [] } = useQuery({
    queryKey: ['band-income-dashboard'],
    queryFn: async () => {
      const records = await base44.entities.IncomeRecord.list('-income_date');
      return records.filter(r => r.record_type === 'band_total');
    },
    initialData: [],
  });

  const { data: bandExpenses = [] } = useQuery({
    queryKey: ['band-expenses-dashboard'],
    queryFn: async () => {
      const allExpenses = await base44.entities.Expense.list('-expense_date');
      return allExpenses.filter(e => e.expense_type === 'band');
    },
    initialData: [],
  });

  const { data: unpaidSessionPayments = [] } = useQuery({
    queryKey: ['unpaid-session-payments-dashboard'],
    queryFn: async () => {
      const all = await base44.entities.SessionPayment.list();
      return all.filter(sp => !sp.paid);
    },
    initialData: [],
  });
  
  const totalOwedToMusicians = unpaidSessionPayments.reduce((sum, sp) => sum + sp.amount, 0);

  // Removed the `if (!user)` loading spinner, as the app is now public and
  // the dashboard should render even if no user is logged in (user is null).
  // Features requiring a user will degrade gracefully or be hidden by conditional rendering.

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const upcomingGigs = gigs.filter(gig => isAfter(new Date(gig.date), today)).slice(0, 5);
  const upcomingBookings = bookings.filter(booking => isAfter(new Date(booking.event_date), today));
  
  // CRITICAL: Band net profit calculation
  // Revenue = What band received from clients
  const totalRevenue = bandIncomeRecords.reduce((sum, record) => sum + record.amount, 0);
  
  // Expenses = What band paid out (session payments + other band costs)
  const totalExpenses = bandExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  
  // Net Profit = Revenue - All Expenses
  // Should be ~£0 if all musicians have been paid
  // Will be positive if some payments are still pending
  const netProfit = totalRevenue - totalExpenses - totalOwedToMusicians;
  
  const uniquePendingBookings = bookings
    .filter(b => {
      const eventDate = new Date(b.event_date);
      eventDate.setHours(23, 59, 59, 999);
      const now = new Date();
      return isBefore(eventDate, now) && 
             b.payment_status !== 'paid_in_full' && 
             b.payment_method === 'invoice';
    })
    .reduce((acc, booking) => {
      if (!acc.seen.has(booking.id)) {
        acc.seen.add(booking.id);
        acc.bookings.push(booking);
      }
      return acc;
    }, { seen: new Set(), bookings: [] }).bookings;

  const pendingPayments = uniquePendingBookings.reduce((sum, b) => sum + ((b.fee || 0) - (b.deposit_paid || 0)), 0);

  const managementSections = [
    {
      title: "Bookings & Invoices",
      description: "Track bookings and generate invoices",
      icon: PoundSterling,
      color: "from-orange-500 to-orange-600",
      url: createPageUrl("Bookings"),
      stats: `${bookings.length} total bookings`
    },
    {
      title: "Band Finances",
      description: "Track band income, expenses & session payments",
      icon: Building2,
      color: "from-blue-500 to-blue-600",
      url: createPageUrl("BandFinances"),
      stats: "Income & expenses"
    },
    {
      title: "Member Availability",
      description: "Track when band members are unavailable",
      icon: Users,
      color: "from-purple-500 to-purple-600",
      url: createPageUrl("Availability"),
      stats: `${unavailability.filter(u => isAfter(new Date(u.end_date), today)).length} current`
    },
    {
      title: "Band Members",
      description: "Manage band member information",
      icon: Users,
      color: "from-indigo-500 to-indigo-600",
      url: createPageUrl("BandManagement"),
      stats: "Edit names and roles"
    },
    {
      title: "Customize App",
      description: "Change background image and logo",
      icon: Sparkles,
      color: "from-purple-500 to-pink-600",
      url: createPageUrl("CustomizeApp"),
      stats: "Branding & appearance"
    },
    {
      title: "File Storage",
      description: "Access all uploaded files",
      icon: FileText,
      color: "from-cyan-500 to-cyan-600",
      url: createPageUrl("Files"),
      stats: "Organized by category"
    },
    {
      title: "Merchandise Shop",
      description: "Manage InkThreadable products",
      icon: Music,
      color: "from-pink-500 to-pink-600",
      url: createPageUrl("ManageMerch"),
      stats: "Add & edit products"
    },
    {
      title: "Activity Log",
      description: "Monitor all changes by band members",
      icon: FileText,
      color: "from-blue-500 to-blue-600",
      url: createPageUrl("ActivityLog"),
      stats: "Track recent activity"
    },
    {
      title: "Engagement Analytics",
      description: "Track performance metrics and trends",
      icon: FileText,
      color: "from-green-500 to-green-600",
      url: createPageUrl("Analytics"),
      stats: `${bookings.length} total bookings`
    },
    {
      title: "Photo Gallery",
      description: "Upload and manage band photos",
      icon: ImageIcon,
      color: "from-blue-500 to-blue-600",
      url: createPageUrl("ManagePhotos"),
      stats: `${photos.length} photos`
    },
    {
      title: "Video Gallery",
      description: "Upload and manage performance videos",
      icon: VideoIcon,
      color: "from-pink-500 to-pink-600",
      url: createPageUrl("ManageVideos"),
      stats: `${videos.length} videos`
    },
    {
      title: "Set List",
      description: "Manage repertoire and track stems",
      icon: Music,
      color: "from-emerald-500 to-emerald-600",
      url: createPageUrl("SetList"),
      stats: "Multi-track mixer"
    }
  ];

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Band Dashboard</h1>
          <p className="text-gray-400">Welcome back! Manage your band activities</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 space-y-3"
        >
          {!showQuickInput && !showVoiceInput && ( 
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Button
                onClick={() => {
                  setShowQuickInput(true); 
                  setShowVoiceInput(false);
                }}
                className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 min-h-[56px] text-base"
              >
                ⚡ Quick Add (Type Keywords) 
              </Button>
              <Button
                onClick={() => {
                  setShowVoiceInput(true);
                  setShowQuickInput(false); 
                }}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 min-h-[56px] text-base"
              >
                <Mic className="w-5 h-5 mr-2" />
                Add by Voice
              </Button>
              <Button
                onClick={() => navigate(createPageUrl("Bookings"))}
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 min-h-[56px] text-base"
              >
                <Plus className="w-5 h-5 mr-2" />
                New Booking
              </Button>
            </div>
          )}

          {showQuickInput && <UnifiedQuickInput onClose={() => setShowQuickInput(false)} />} 
          {showVoiceInput && <UnifiedVoiceInput onClose={() => setShowVoiceInput(false)} />}
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Card className="bg-white/5 backdrop-blur-sm border-green-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-gray-400">Upcoming Gigs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-white">{upcomingBookings.length}</div>
                <Calendar className="w-6 h-6 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-sm border-blue-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-gray-400">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-white">£{totalRevenue.toFixed(0)}</div>
                <PoundSterling className="w-6 h-6 text-blue-500" />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {bandIncomeRecords.length} record{bandIncomeRecords.length !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-sm border-orange-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-gray-400">Total Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-white">£{totalExpenses.toFixed(0)}</div>
                <PoundSterling className="w-6 h-6 text-orange-500" />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {bandExpenses.length} record{bandExpenses.length !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="bg-white/5 backdrop-blur-sm border-purple-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-gray-400">Band Net</CardTitle>
              </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  £{netProfit.toFixed(0)}
                </div>
                <TrendingUp className="w-6 h-6 text-purple-500" />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {totalOwedToMusicians > 0 ? `£${totalOwedToMusicians.toFixed(0)} owed to musicians` : 'All paid'}
              </p>
            </CardContent>
            </Card>
          </motion.div>

          <Card className="bg-white/5 backdrop-blur-sm border-yellow-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-gray-400">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-white">£{pendingPayments.toFixed(0)}</div>
                <PoundSterling className="w-6 h-6 text-yellow-500" />
              </div>
              <p className="text-xs text-gray-500 mt-1">Awaiting payment</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-sm border-pink-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-gray-400">Media</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-white">{photos.length + videos.length}</div>
                <ImageIcon className="w-6 h-6 text-pink-500" />
              </div>
              <p className="text-xs text-gray-500 mt-1">{photos.length} photos, {videos.length} videos</p>
            </CardContent>
          </Card>
        </div>
        
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-6">Band Management</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0 }}
            >
              <MiniCalendar bookings={bookings} unavailability={unavailability} />
            </motion.div>

            {managementSections.map((section, index) => (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: (index + 1) * 0.1 }}
              >
                <Link to={section.url}>
                  <Card className="bg-white/5 backdrop-blur-sm border-white/10 hover:border-orange-500/50 transition-all cursor-pointer group h-full">
                    <CardHeader>
                      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${section.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                        <section.icon className="w-7 h-7 text-white" />
                      </div>
                      <CardTitle className="text-white group-hover:text-orange-400 transition-colors flex items-center justify-between">
                        {section.title}
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-400 text-sm mb-3">{section.description}</p>
                      <p className="text-orange-400 text-sm font-medium">{section.stats}</p>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: (managementSections.length + 1) * 0.1 }}
            >
              <Link to={createPageUrl("Expenses")}>
                <Card className="bg-white/5 backdrop-blur-sm border-white/10 hover:border-orange-500/50 transition-all cursor-pointer group h-full">
                  <CardHeader>
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <PoundSterling className="w-7 h-7 text-white" />
                    </div>
                    <CardTitle className="text-white group-hover:text-orange-400 transition-colors flex items-center justify-between">
                      My Expenses
                      <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-400 text-sm mb-3">Track your mileage and expenses</p>
                    <p className="text-orange-400 text-sm font-medium">Tax deductions</p>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          </div>
        </div>

        <div className="mb-8">
          <Card className="bg-white/5 backdrop-blur-sm border-orange-500/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-orange-500" />
                  Member Unavailability
                </CardTitle>
                <Link to={createPageUrl("Availability")}>
                  <Button variant="ghost" size="sm" className="text-orange-400 hover:text-orange-300">
                    View All <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {unavailability.length === 0 ? (
                <p className="text-gray-400">All members available</p>
              ) : (
                <div className="space-y-3">
                  {unavailability.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div>
                        <h4 className="font-semibold text-white text-sm">{item.member_name}</h4>
                        <p className="text-xs text-gray-400">{item.reason || 'No reason provided'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-orange-400">
                          {format(new Date(item.start_date), 'MMM d')} - {format(new Date(item.end_date), 'MMM d')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Data Checking Tools - Moved to Bottom */}
        <div className="mt-16 space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">Data Checking Tools</h2>
            <p className="text-gray-400">Diagnostic and repair tools for data integrity</p>
          </div>
          
          <PaymentReminder />
          <BulkInvoiceGenerator />
          <AddressUpdater />
          <SessionPaymentTracker />
          {user?.role === 'admin' && ( // This will only render if a user is logged in AND is an admin
            <RetroactiveRecordGenerator />
          )}
          <MissingInfoChecker />
          <DeepTestAnalyzer />
        </div>
      </div>
    </div>
  );
}
