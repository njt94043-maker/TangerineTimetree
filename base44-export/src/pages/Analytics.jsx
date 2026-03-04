
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, Calendar, PoundSterling, MapPin, Users, ImageIcon, VideoIcon, BarChart3, AlertCircle } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, isAfter, isBefore } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";

export default function Analytics() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState(12); // months

  // Removed auth check - app is now public

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => base44.entities.Booking.list('-event_date'),
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

  // Get band income records (from clients)
  const { data: bandIncomeRecords = [] } = useQuery({
    queryKey: ['band-income-analytics'],
    queryFn: async () => {
      const records = await base44.entities.IncomeRecord.list('-income_date');
      return records.filter(r => r.record_type === 'band_total');
    },
    initialData: [],
  });

  // Get all expenses to separate into band operating and session payments
  const { data: allExpenses = [] } = useQuery({
    queryKey: ['all-expenses-analytics'],
    queryFn: () => base44.entities.Expense.list('-expense_date'),
    initialData: [],
  });

  // Get unpaid session payments
  const { data: unpaidSessionPayments = [] } = useQuery({
    queryKey: ['unpaid-session-payments-analytics'],
    queryFn: async () => {
      const all = await base44.entities.SessionPayment.list();
      return all.filter(sp => !sp.paid);
    },
    initialData: [],
  });

  // Separate expenses into band operating expenses and session musician payments
  const bandOperatingExpenses = allExpenses.filter(e => e.expense_type === 'band');
  const sessionMusicianPayments = allExpenses.filter(e => e.expense_type === 'session_musician');

  // Calculate metrics
  const today = new Date();
  const startDate = subMonths(today, timeRange);

  const recentBookings = bookings.filter(b => isAfter(new Date(b.created_date), startDate));
  const completedBookings = bookings.filter(b => b.status === 'completed');
  const upcomingBookings = bookings.filter(b => isAfter(new Date(b.event_date), today));

  // Revenue metrics
  // Total Revenue = What band received from clients
  const totalRevenue = bandIncomeRecords.reduce((sum, record) => sum + record.amount, 0);
  
  // Total Band Operating Expenses = What band paid out for its operations
  const totalBandOperatingExpenses = bandOperatingExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  // Total Session Musician Payments = What band paid out to session musicians
  const totalSessionMusicianPayments = sessionMusicianPayments.reduce((sum, expense) => sum + expense.amount, 0);
  
  // Total Expenses (for display in card) = Band Operating Expenses + Session Musician Payments
  const totalExpenses = totalBandOperatingExpenses + totalSessionMusicianPayments;

  const totalOwedToMusicians = unpaidSessionPayments.reduce((sum, sp) => sum + sp.amount, 0);

  // Net Profit = Total Revenue - Total Band Operating Expenses - Total Session Musician Payments - Total Owed To Musicians
  // This aligns with the "BUSINESS (band contractor)" net calculation (Income - Session Payments - Other Band Expenses)
  const netProfit = totalRevenue - totalBandOperatingExpenses - totalSessionMusicianPayments - totalOwedToMusicians;

  // Pending payments from clients (not yet received)
  const pendingRevenue = bookings
    .filter(b => {
      const eventDate = new Date(b.event_date);
      eventDate.setHours(23, 59, 59, 999);
      const now = new Date();
      return isBefore(eventDate, now) && 
             b.payment_status !== 'paid_in_full' && 
             b.payment_method === 'invoice';
    })
    .reduce((sum, b) => sum + ((b.fee || 0) - (b.deposit_paid || 0)), 0);

  // Average booking value (from invoiced gigs only)
  const invoiceBookings = bookings.filter(b => b.payment_method === 'invoice');

  const averageBookingValue = invoiceBookings.length > 0 
    ? (invoiceBookings.reduce((sum, b) => sum + (b.fee || 0), 0) / invoiceBookings.length).toFixed(0)
    : 0;

  // Monthly booking trends
  const months = eachMonthOfInterval({
    start: startDate,
    end: today
  });

  const monthlyData = months.map(month => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    
    const monthBookings = bookings.filter(b => {
      const bookingDate = new Date(b.event_date);
      return isAfter(bookingDate, monthStart) && isBefore(bookingDate, monthEnd);
    });

    // Revenue for this month
    const monthIncome = bandIncomeRecords.filter(record => {
      const incomeDate = new Date(record.income_date);
      return isAfter(incomeDate, monthStart) && isBefore(incomeDate, monthEnd);
    });
    const revenue = monthIncome.reduce((sum, record) => sum + record.amount, 0);

    // Band Operating Expenses for this month
    const monthBandOperatingExpenses = bandOperatingExpenses.filter(expense => {
      const expenseDate = new Date(expense.expense_date);
      return isAfter(expenseDate, monthStart) && isBefore(expenseDate, monthEnd);
    });
    const bandOperatingExpensesSum = monthBandOperatingExpenses.reduce((sum, expense) => sum + expense.amount, 0);

    // Session Musician Payments for this month
    const monthSessionMusicianPayments = sessionMusicianPayments.filter(payment => {
      const paymentDate = new Date(payment.expense_date); // Assuming expense_date for payments too
      return isAfter(paymentDate, monthStart) && isBefore(paymentDate, monthEnd);
    });
    const sessionMusicianPaymentsSum = monthSessionMusicianPayments.reduce((sum, payment) => sum + payment.amount, 0);

    // Total expenses for the month including band operating and session payments
    const totalMonthExpenses = bandOperatingExpensesSum + sessionMusicianPaymentsSum;

    return {
      month: format(month, 'MMM yy'),
      bookings: monthBookings.length,
      revenue: revenue,
      expenses: totalMonthExpenses, // Now includes both types of expenses
      profit: revenue - totalMonthExpenses // This profit calculation does not yet include *unpaid* session payments
    };
  });

  // Event type distribution
  const eventTypes = bookings.reduce((acc, booking) => {
    const type = booking.event_type || 'other';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const eventTypeData = Object.entries(eventTypes).map(([name, value]) => ({
    name: name.replace('_', ' '),
    value,
    color: {
      wedding: '#ec4899',
      corporate: '#3b82f6',
      pub_gig: '#10b981',
      festival: '#f97316',
      private_party: '#a855f7',
      other: '#6b7280'
    }[name] || '#6b7280'
  }));

  // Top venues
  const venues = bookings.reduce((acc, booking) => {
    const venue = booking.venue_name;
    if (venue) {
      acc[venue] = (acc[venue] || 0) + 1;
    }
    return acc;
  }, {});

  const topVenues = Object.entries(venues)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // Payment status distribution
  const paymentStatus = bookings.reduce((acc, booking) => {
    const status = booking.payment_status || 'unpaid';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const paymentStatusData = Object.entries(paymentStatus).map(([name, value]) => ({
    name: name.replace('_', ' '),
    value,
    color: {
      paid_in_full: '#10b981',
      deposit_paid: '#f59e0b',
      unpaid: '#ef4444'
    }[name] || '#6b7280'
  }));

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Engagement Analytics</h1>
          <p className="text-gray-400">Track your band's performance and bookings</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="bg-white/5 backdrop-blur-sm border-green-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-gray-400">Total Bookings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold text-white">{bookings.length}</div>
                  <Calendar className="w-6 h-6 text-green-500" />
                </div>
                <p className="text-xs text-gray-500 mt-1">{upcomingBookings.length} upcoming</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="bg-white/5 backdrop-blur-sm border-blue-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-gray-400">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold text-white">£{totalRevenue.toFixed(0)}</div>
                  <PoundSterling className="w-6 h-6 text-blue-500" />
                </div>
                <p className="text-xs text-gray-500 mt-1">From clients</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="bg-white/5 backdrop-blur-sm border-orange-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-gray-400">Total Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold text-white">£{totalExpenses.toFixed(0)}</div>
                  <PoundSterling className="w-6 h-6 text-orange-500" />
                </div>
                <p className="text-xs text-gray-500 mt-1">Band costs & payments</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="bg-white/5 backdrop-blur-sm border-purple-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-gray-400">Net Profit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    £{netProfit.toFixed(0)}
                  </div>
                  <TrendingUp className="w-6 h-6 text-purple-500" />
                </div>
                <p className="text-xs text-gray-500 mt-1">Overall band</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card className="bg-white/5 backdrop-blur-sm border-yellow-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-gray-400">Avg Booking</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold text-white">£{averageBookingValue}</div>
                  <BarChart3 className="w-6 h-6 text-yellow-500" />
                </div>
                <p className="text-xs text-gray-500 mt-1">per event</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Monthly Revenue vs Expenses */}
          <Card className="bg-white/5 backdrop-blur-sm border-green-500/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Monthly Revenue vs Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="month" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Legend />
                  <Bar dataKey="revenue" fill="#10b981" name="Revenue" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="expenses" fill="#f97316" name="Expenses" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Monthly Net Profit */}
          <Card className="bg-white/5 backdrop-blur-sm border-purple-500/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Monthly Net Profit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="month" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Line type="monotone" dataKey="profit" stroke="#a855f7" strokeWidth={2} dot={{ fill: '#a855f7' }} name="Profit" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Event Types */}
          <Card className="bg-white/5 backdrop-blur-sm border-blue-500/20">
            <CardHeader>
              <CardTitle className="text-white">Event Types Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={eventTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {eventTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Payment Status */}
          <Card className="bg-white/5 backdrop-blur-sm border-purple-500/20">
            <CardHeader>
              <CardTitle className="text-white">Payment Status</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={paymentStatusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {paymentStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Top Venues */}
        <Card className="bg-white/5 backdrop-blur-sm border-green-500/20 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Top Venues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topVenues.map((venue, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold">
                      {index + 1}
                    </div>
                    <span className="text-white font-medium">{venue.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-48 bg-white/5 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-green-500 h-full rounded-full transition-all"
                        style={{ width: `${(venue.count / topVenues[0].count) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-gray-400 text-sm w-16 text-right">{venue.count} gigs</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Site Engagement - Coming Soon */}
        <Card className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 backdrop-blur-sm border-purple-500/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl"></div>
          
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-400" />
                Website Engagement Analytics
              </CardTitle>
              <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-xs font-semibold">
                Coming Soon
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-300 mb-6">
              Advanced visitor engagement tracking will be available once analytics integrations are enabled. 
              This will provide insights into how visitors interact with your band's website.
            </p>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-purple-400" />
                  </div>
                  <h4 className="font-semibold text-white">Visitor Metrics</h4>
                </div>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>• Total page views</li>
                  <li>• Unique visitors</li>
                  <li>• Average session duration</li>
                  <li>• Bounce rate</li>
                </ul>
              </div>

              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <VideoIcon className="w-5 h-5 text-blue-400" />
                  </div>
                  <h4 className="font-semibold text-white">Media Engagement</h4>
                </div>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>• Video play counts</li>
                  <li>• Watch duration</li>
                  <li>• Photo gallery views</li>
                  <li>• Most popular content</li>
                </ul>
              </div>

              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-green-400" />
                  </div>
                  <h4 className="font-semibold text-white">Interaction Tracking</h4>
                </div>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>• Button clicks</li>
                  <li>• Link interactions</li>
                  <li>• Social media clicks</li>
                  <li>• Contact form submissions</li>
                </ul>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <p className="text-sm text-blue-300">
                💡 <strong>Note:</strong> To enable these analytics, please contact the base44 team through the feedback button 
                on the sidebar to request Google Analytics or similar analytics integration for your app.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
