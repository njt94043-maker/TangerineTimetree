
import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Music, CheckCircle2, Clock, Volume2, Shield, Zap, 
  Users, Calendar, Mail, Phone, MapPin, Star 
} from "lucide-react";
import { motion } from "framer-motion";

export default function ForVenues() {
  // Add SEO meta tags
  useEffect(() => {
    document.title = "For Venues | The Green Tangerine - Book South Wales Function Band";
    
    let metaDescription = document.querySelector('meta[name="description"]');
    const descriptionContent = 'Book The Green Tangerine for your venue in Cardiff, Swansea, Bridgend, or Neath. Professional live band with full PA, lighting, and insurance. Reliable entertainment for pubs, clubs, and events across South Wales.';

    if (metaDescription) {
      metaDescription.setAttribute('content', descriptionContent);
    } else {
      metaDescription = document.createElement('meta');
      metaDescription.name = 'description';
      metaDescription.content = descriptionContent;
      document.head.appendChild(metaDescription);
    }

    // Open Graph tags
    const ogTags = [
      { property: 'og:title', content: 'For Venues | The Green Tangerine - Professional Function Band' },
      { property: 'og:description', content: 'Fully self-contained function band for venues across South Wales. Professional PA, lighting, insurance, and reliable service. Perfect for pubs, clubs and events.' },
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

    // Clean up function to revert title/description if component unmounts,
    // though typically for single-page apps, titles are set per-route and not reverted.
    // For meta descriptions, it's good practice to ensure they are unique per page.
    return () => {
      // Potentially revert to a default title or remove specific meta tags
      // if this page is not the primary one setting them globally.
      // For this specific use case, we assume title/description are managed by the router/each page.
    };
  }, []);

  const benefits = [
    {
      icon: Zap,
      title: "Fully Self-Contained",
      description: "Professional P.A. system and lighting included - no extra hire costs for you"
    },
    {
      icon: Clock,
      title: "Quick Setup & Soundcheck",
      description: "We arrive early, set up efficiently, and soundcheck without disrupting your venue"
    },
    {
      icon: Music,
      title: "Flexible Set Options",
      description: "2x45-minute sets or 1x90-minute set - we adapt to your event needs"
    },
    {
      icon: Volume2,
      title: "Volume Control",
      description: "Perfect for intimate venues - we can adjust to suit any space"
    },
    {
      icon: Shield,
      title: "Fully Insured & Professional",
      description: "Public liability insurance and PAT-tested equipment as standard"
    },
    {
      icon: Users,
      title: "Proven Track Record",
      description: "100% recommended by venues across the Rhondda and South Wales"
    }
  ];

  const venues = [
    { name: "Cardiff Venues", location: "Cardiff City Centre" },
    { name: "Bridgend Clubs", location: "Bridgend" },
    { name: "Swansea Pubs", location: "Swansea" },
    { name: "Rhondda Events", location: "Rhondda Valley" },
  ];

  const testimonials = [
    {
      quote: "The Green Tangerine brought amazing energy to our venue. The crowd loved every minute!",
      venue: "Cardiff Venue",
      rating: 5
    },
    {
      quote: "Professional setup, great communication, and an incredible live show. Highly recommended.",
      venue: "Bridgend Function Room",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <Badge className="bg-green-500/20 text-green-400 mb-4">
            <MapPin className="w-3 h-3 mr-1" />
            Based in Rhondda, Covering All South Wales
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Book The Green Tangerine for Your Venue
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-2">
            High-energy live band bringing classic rock covers to pubs, clubs, and events across Cardiff, Swansea, Bridgend, Neath & the Rhondda
          </p>
          <p className="text-lg text-gray-500">
            Reliable • Professional • Crowd-Pleasing
          </p>
        </motion.div>

        {/* Benefits Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {benefits.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <Card className="bg-white/5 backdrop-blur-sm border-green-500/20 h-full hover:border-green-500/50 transition-all">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center mb-3">
                    <benefit.icon className="w-6 h-6 text-green-400" />
                  </div>
                  <CardTitle className="text-white text-lg">{benefit.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-400 text-sm">{benefit.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* What We Offer */}
        <Card className="bg-gradient-to-br from-green-500/10 to-orange-500/10 backdrop-blur-sm border-green-500/30 mb-12">
          <CardHeader>
            <CardTitle className="text-white text-2xl">What We Bring to Your Venue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-green-400 font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Equipment & Setup
                </h3>
                <ul className="space-y-2 text-gray-300 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">•</span>
                    <span>Professional full-range P.A. system</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">•</span>
                    <span>Stage lighting rig</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">•</span>
                    <span>All cables, stands, and accessories</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">•</span>
                    <span>Quick 45-minute setup time</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">•</span>
                    <span>Efficient pack-down (no late fees!)</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-orange-400 font-semibold mb-3 flex items-center gap-2">
                  <Music className="w-5 h-5" />
                  Performance Options
                </h3>
                <ul className="space-y-2 text-gray-300 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-orange-400 mt-1">•</span>
                    <span>2x45-minute sets with 15-minute break</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-400 mt-1">•</span>
                    <span>OR 1x90-minute continuous set</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-400 mt-1">•</span>
                    <span>Curated setlist of crowd-pleasing classics</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-400 mt-1">•</span>
                    <span>Volume adaptable to venue size</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-400 mt-1">•</span>
                    <span>Background music during breaks (if needed)</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <h3 className="text-blue-300 font-semibold mb-2 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Peace of Mind
              </h3>
              <div className="grid md:grid-cols-2 gap-3 text-sm text-gray-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  Public liability insurance
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  PAT-tested equipment
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  Professional contracts
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  Reliable communication
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Venues */}
        <Card className="bg-white/5 backdrop-blur-sm border-purple-500/20 mb-12">
          <CardHeader>
            <CardTitle className="text-white text-2xl">Where We Play</CardTitle>
            <p className="text-gray-400 text-sm">Trusted by venues across Cardiff, Swansea, Bridgend, Neath, and the Rhondda</p>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {venues.map((venue, index) => (
                <div 
                  key={index}
                  className="bg-white/5 rounded-lg p-4 border border-white/10 hover:border-purple-500/50 transition-all"
                >
                  <MapPin className="w-5 h-5 text-purple-400 mb-2" />
                  <h4 className="text-white font-semibold">{venue.name}</h4>
                  <p className="text-gray-400 text-sm">{venue.location}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Testimonials */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="bg-white/5 backdrop-blur-sm border-yellow-500/20">
              <CardContent className="pt-6">
                <div className="flex gap-1 mb-3">
                  {Array(testimonial.rating).fill(0).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                  ))}
                </div>
                <p className="text-gray-300 italic mb-4">"{testimonial.quote}"</p>
                <p className="text-sm text-gray-500">— {testimonial.venue}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="bg-gradient-to-r from-green-500/20 to-orange-500/20 rounded-2xl p-8 border border-green-500/30 text-center"
        >
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Book The Green Tangerine?</h2>
          <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
            Get in touch today to discuss your venue's needs and check our availability. 
            We cover all of South Wales including Cardiff, Swansea, Bridgend, Neath, Rhondda, and beyond.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to={createPageUrl("Contact")}>
              <Button size="lg" className="bg-gradient-to-r from-green-500 to-orange-500 hover:from-green-600 hover:to-orange-600 text-white px-8 py-6 text-lg">
                <Mail className="w-5 h-5 mr-2" />
                Contact Us
              </Button>
            </Link>
            <Link to={createPageUrl("Pricing")}>
              <Button size="lg" variant="outline" className="border-green-500/50 text-green-400 hover:bg-green-500/10 px-8 py-6 text-lg">
                <Calendar className="w-5 h-5 mr-2" />
                View Pricing
              </Button>
            </Link>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-gray-400">
            <a href="mailto:thegreentangerine01@gmail.com" className="flex items-center gap-2 hover:text-green-400 transition-colors">
              <Mail className="w-4 h-4" />
              thegreentangerine01@gmail.com
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
