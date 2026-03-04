
import React from "react"; // Removed useEffect as it's no longer used for auth check
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom"; // Keep navigate for potential future uses, though not used here now
import { createPageUrl } from "@/utils"; // Keep createPageUrl for potential future uses, though not used here now
import { format } from "date-fns";
import { Clock, User, FileText, Calendar, Users, Music, Image as ImageIcon, Video, Loader2 } from "lucide-react";

export default function ActivityLog() {
  const navigate = useNavigate();

  // Removed auth check - app is now public
  // The useEffect hook for authentication has been removed as per the instructions
  // to make the entire app public and remove all authentication checks.

  // Fetch all entities
  const { data: bookings = [], isLoading: loadingBookings } = useQuery({
    queryKey: ['bookings-activity'],
    queryFn: () => base44.entities.Booking.list('-created_date'),
    initialData: [],
  });

  const { data: unavailability = [], isLoading: loadingUnavailability } = useQuery({
    queryKey: ['unavailability-activity'],
    queryFn: () => base44.entities.Unavailability.list('-created_date'),
    initialData: [],
  });

  const { data: photos = [], isLoading: loadingPhotos } = useQuery({
    queryKey: ['photos-activity'],
    queryFn: () => base44.entities.Photo.list('-created_date'),
    initialData: [],
  });

  const { data: videos = [], isLoading: loadingVideos } = useQuery({
    queryKey: ['videos-activity'],
    queryFn: () => base44.entities.Video.list('-created_date'),
    initialData: [],
  });

  const { data: songs = [], isLoading: loadingSongs } = useQuery({
    queryKey: ['songs-activity'],
    queryFn: () => base44.entities.Song.list('-created_date'),
    initialData: [],
  });

  // Combine all activities into one timeline
  const allActivities = [
    ...bookings.map(item => ({
      id: item.id,
      type: 'booking',
      action: 'created',
      title: `${item.venue_name} - ${item.client_name}`,
      date: item.event_date,
      created_by: item.created_by,
      created_date: item.created_date,
      updated_date: item.updated_date,
      icon: Calendar,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10'
    })),
    ...unavailability.map(item => ({
      id: item.id,
      type: 'unavailability',
      action: 'created',
      title: `${item.member_name} unavailable`,
      date: `${item.start_date} to ${item.end_date}`,
      created_by: item.created_by,
      created_date: item.created_date,
      updated_date: item.updated_date,
      icon: Users,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10'
    })),
    ...photos.map(item => ({
      id: item.id,
      type: 'photo',
      action: 'uploaded',
      title: item.title,
      date: item.date_taken || '',
      created_by: item.created_by,
      created_date: item.created_date,
      updated_date: item.updated_date,
      icon: ImageIcon,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10'
    })),
    ...videos.map(item => ({
      id: item.id,
      type: 'video',
      action: 'uploaded',
      title: item.title,
      date: item.date_performed || '',
      created_by: item.created_by,
      created_date: item.created_date,
      updated_date: item.updated_date,
      icon: Video,
      color: 'text-pink-400',
      bgColor: 'bg-pink-500/10'
    })),
    ...songs.map(item => ({
      id: item.id,
      type: 'song',
      action: 'added',
      title: `${item.title} - ${item.artist}`,
      date: '',
      created_by: item.created_by,
      created_date: item.created_date,
      updated_date: item.updated_date,
      icon: Music,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10'
    }))
  ].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  const isLoading = loadingBookings || loadingUnavailability || loadingPhotos || loadingVideos || loadingSongs;

  // Get unique users who have made changes
  const activeUsers = [...new Set(allActivities.map(a => a.created_by))].filter(Boolean);

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Activity Log</h1>
          <p className="text-gray-400">Monitor all changes made by band members</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-white/5 backdrop-blur-sm border-green-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-gray-400">Total Activities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{allActivities.length}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-sm border-blue-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-gray-400">Active Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{activeUsers.length}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-sm border-orange-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-gray-400">Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{bookings.length}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-sm border-purple-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-gray-400">Unavailability</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{unavailability.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Timeline */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
          </div>
        ) : allActivities.length === 0 ? (
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardContent className="py-20 text-center">
              <Clock className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No activity recorded yet</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-green-400" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {allActivities.map((activity) => {
                  const Icon = activity.icon;
                  const wasUpdated = new Date(activity.updated_date) > new Date(activity.created_date);
                  
                  return (
                    <div key={`${activity.type}-${activity.id}`} className="flex items-start gap-4 p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-all">
                      <div className={`w-12 h-12 rounded-full ${activity.bgColor} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-6 h-6 ${activity.color}`} />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div>
                            <h3 className="text-white font-medium">{activity.title}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs border-white/20 text-gray-400">
                                {activity.type}
                              </Badge>
                              {wasUpdated && (
                                <Badge variant="outline" className="text-xs border-yellow-500/30 text-yellow-400">
                                  Updated
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right text-sm">
                            <p className="text-gray-400">
                              {format(new Date(wasUpdated ? activity.updated_date : activity.created_date), 'MMM d, yyyy')}
                            </p>
                            <p className="text-gray-500 text-xs">
                              {format(new Date(wasUpdated ? activity.updated_date : activity.created_date), 'HH:mm')}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-2 text-gray-400">
                            <User className="w-4 h-4" />
                            <span>{activity.created_by || 'Unknown'}</span>
                          </div>
                          {activity.date && (
                            <div className="text-gray-500">
                              {activity.date}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
