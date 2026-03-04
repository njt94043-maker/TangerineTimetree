
import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, RotateCcw, Volume2, VolumeX, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function SongMixer() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const songId = urlParams.get('id');

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRefs = useRef({
    vocal: null,
    guitar: null,
    bass: null,
    drums: null,
    keys: null
  });

  const [volumes, setVolumes] = useState({
    vocal: 100,
    guitar: 100,
    bass: 100,
    drums: 100,
    keys: 100
  });

  const [muted, setMuted] = useState({
    vocal: false,
    guitar: false,
    bass: false,
    drums: false,
    keys: false
  });

  // Removed auth check - app is now public

  const { data: song } = useQuery({
    queryKey: ['song', songId],
    queryFn: async () => {
      const songs = await base44.entities.Song.list();
      return songs.find(s => s.id === songId);
    },
    enabled: !!songId,
  });

  useEffect(() => {
    if (!song) return;

    // Initialize audio elements
    const tracks = {
      vocal: song.vocal_track_url,
      guitar: song.guitar_track_url,
      bass: song.bass_track_url,
      drums: song.drums_track_url,
      keys: song.keys_track_url
    };

    Object.entries(tracks).forEach(([key, url]) => {
      if (url && !audioRefs.current[key]) {
        const audio = new Audio(url);
        audio.preload = 'auto';
        audioRefs.current[key] = audio;

        audio.addEventListener('timeupdate', () => {
          if (key === 'vocal' || (key === 'guitar' && !tracks.vocal)) {
            setCurrentTime(audio.currentTime);
          }
        });

        audio.addEventListener('loadedmetadata', () => {
          if (key === 'vocal' || (key === 'guitar' && !tracks.vocal)) {
            setDuration(audio.duration);
          }
        });
      }
    });

    return () => {
      Object.values(audioRefs.current).forEach(audio => {
        if (audio) {
          audio.pause();
          audio.src = '';
        }
      });
    };
  }, [song]);

  const togglePlay = () => {
    Object.values(audioRefs.current).forEach(audio => {
      if (audio) {
        if (isPlaying) {
          audio.pause();
        } else {
          audio.play();
        }
      }
    });
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    Object.values(audioRefs.current).forEach(audio => {
      if (audio) {
        audio.currentTime = 0;
      }
    });
    setCurrentTime(0);
  };

  const handleVolumeChange = (track, value) => {
    const newVolume = value[0];
    setVolumes(prev => ({ ...prev, [track]: newVolume }));
    if (audioRefs.current[track]) {
      audioRefs.current[track].volume = newVolume / 100;
    }
  };

  const toggleMute = (track) => {
    const newMuted = !muted[track];
    setMuted(prev => ({ ...prev, [track]: newMuted }));
    if (audioRefs.current[track]) {
      audioRefs.current[track].muted = newMuted;
    }
  };

  const handleSeek = (value) => {
    const newTime = value[0];
    Object.values(audioRefs.current).forEach(audio => {
      if (audio) {
        audio.currentTime = newTime;
      }
    });
    setCurrentTime(newTime);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const categoryColors = {
    main: "bg-blue-500/20 text-blue-400",
    popular_mainstream: "bg-purple-500/20 text-purple-400",
    classic_rock_muso: "bg-orange-500/20 text-orange-400"
  };

  const categoryLabels = {
    main: "Main Song",
    popular_mainstream: "Popular Mainstream",
    classic_rock_muso: "Classic Rock Muso"
  };

  const tracks = [
    { key: 'vocal', label: 'Vocals', color: 'from-blue-500 to-blue-600', url: song?.vocal_track_url },
    { key: 'guitar', label: 'Guitar', color: 'from-red-500 to-red-600', url: song?.guitar_track_url },
    { key: 'bass', label: 'Bass', color: 'from-purple-500 to-purple-600', url: song?.bass_track_url },
    { key: 'drums', label: 'Drums', color: 'from-orange-500 to-orange-600', url: song?.drums_track_url },
    { key: 'keys', label: 'Keys', color: 'from-green-500 to-green-600', url: song?.keys_track_url }
  ].filter(track => track.url);

  if (!song) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to={createPageUrl("SetList")}>
          <Button variant="ghost" className="text-gray-400 hover:text-white mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Set List
          </Button>
        </Link>

        <Card className="bg-white/5 backdrop-blur-sm border-green-500/20 mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl md:text-3xl text-white mb-2">{song.title}</CardTitle>
                <p className="text-lg text-gray-400 mb-3">{song.artist}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge className={categoryColors[song.category]}>
                    {categoryLabels[song.category]}
                  </Badge>
                  {song.key && <Badge variant="outline" className="text-gray-400">Key: {song.key}</Badge>}
                  {song.tempo && <Badge variant="outline" className="text-gray-400">Tempo: {song.tempo}</Badge>}
                  {song.duration && <Badge variant="outline" className="text-gray-400">{song.duration}</Badge>}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {song.notes && (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-orange-400 mb-2">Performance Notes</h4>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{song.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Playback Controls */}
        <Card className="bg-white/5 backdrop-blur-sm border-green-500/20 mb-6">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Button
                  size="lg"
                  onClick={togglePlay}
                  className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleReset}
                  className="border-white/10"
                >
                  <RotateCcw className="w-5 h-5" />
                </Button>
                <div className="flex-1 flex items-center gap-3">
                  <span className="text-sm text-gray-400 min-w-[40px]">{formatTime(currentTime)}</span>
                  <Slider
                    value={[currentTime]}
                    max={duration || 100}
                    step={0.1}
                    onValueChange={handleSeek}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-400 min-w-[40px]">{formatTime(duration)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Track Mixers */}
        <div className="grid md:grid-cols-2 gap-4">
          {tracks.map((track) => (
            <Card key={track.key} className="bg-white/5 backdrop-blur-sm border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <span className="text-lg">{track.label}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => toggleMute(track.key)}
                    className="text-gray-400 hover:text-white"
                  >
                    {muted[track.key] ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className={`h-2 rounded-full bg-gradient-to-r ${track.color} opacity-${muted[track.key] ? '30' : '100'}`}></div>
                  <div className="flex items-center gap-3">
                    <VolumeX className="w-4 h-4 text-gray-500" />
                    <Slider
                      value={[volumes[track.key]]}
                      max={100}
                      step={1}
                      onValueChange={(value) => handleVolumeChange(track.key, value)}
                      className="flex-1"
                      disabled={muted[track.key]}
                    />
                    <Volume2 className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="text-center">
                    <span className="text-2xl font-bold text-white">{volumes[track.key]}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {tracks.length === 0 && (
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardContent className="py-20 text-center">
              <p className="text-gray-400">No tracks uploaded yet. Edit this song to add tracks.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
