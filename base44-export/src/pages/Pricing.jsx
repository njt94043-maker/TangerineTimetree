
import React, { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Mail, Music, Calendar, Clock, MapPin, PoundSterling, Send } from "lucide-react";
import { motion } from "framer-motion";
import { createPageUrl } from "@/utils";

export default function Pricing() {
  useEffect(() => {
    document.title = "Pricing | The Green Tangerine - South Wales Function Band Rates";
    
    const metaDescription = document.querySelector('meta[name="description"]');
    const descriptionContent = 'Transparent pricing for The Green Tangerine function band. View our rates for pubs, weddings, corporate events and festivals across Cardiff, Swansea, Bridgend, Neath and South Wales.';
    
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
      { property: 'og:title', content: 'Pricing | The Green Tangerine - South Wales Function Band' },
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

  const packages = [
    {
      name: "Pub Gig",
      description: "Perfect for local venues and pubs",
      price: "£400-£600",
      duration: "2 x 45 mins + 15 min encore",
      features: [
        "Full 4-piece band",
        "Professional PA system",
        "Lighting setup",
        "2 x 45 minute sets",
        "15 minute encore",
        "Flexible set list",
        "Sound check included"
      ],
      color: "from-green-500 to-emerald-500",
      popular: false
    },
    {
      name: "Private Party",
      description: "Birthdays, anniversaries, celebrations",
      price: "£600-£800",
      duration: "2 x 45 mins + 15 min encore",
      features: [
        "Full 4-piece band",
        "Professional PA & lighting",
        "2 x 45 minute sets",
        "15 minute encore",
        "Custom set list options",
        "MC/announcements if needed",
        "Sound check & setup time"
      ],
      color: "from-purple-500 to-pink-500",
      popular: true
    },
    {
      name: "Wedding",
      description: "Make your special day unforgettable",
      price: "£800-£1200",
      duration: "2 x 45 mins + 15 min encore",
      features: [
        "Full 4-piece band",
        "Premium PA & lighting",
        "2 x 45 minute sets",
        "15 minute encore",
        "First dance song (if requested)",
        "Tailored set list for your guests",
        "Coordination with venue",
        "Sound check & rehearsal",
        "Professional presentation"
      ],
      color: "from-pink-500 to-rose-500",
      popular: false
    },
    {
      name: "Corporate Event",
      description: "Professional entertainment for your business",
      price: "£1000-£1500",
      duration: "2 x 45 mins + 15 min encore",
      features: [
        "Full 4-piece band",
        "Premium equipment",
        "2 x 45 minute sets",
        "15 minute encore",
        "Corporate-appropriate set list",
        "Professional attire",
        "Coordination with event planners",
        "Background music options"
      ],
      color: "from-blue-500 to-cyan-500",
      popular: false
    },
    {
      name: "Festival",
      description: "High-energy performances for festivals",
      price: "£1000+",
      duration: "45-90 min sets",
      features: [
        "Full 4-piece band",
        "Festival-ready equipment",
        "High-energy set list",
        "Quick setup & breakdown",
        "Professional stage presence",
        "Crowd engagement",
        "Technical coordination",
        "Flexible set duration"
      ],
      color: "from-orange-500 to-red-500",
      popular: false
    }
  ];

  const additionalServices = [
    "Travel within 50 miles included",
    "Additional travel: £0.50 per mile",
    "Extra sets: £100-£200 per hour",
    "Custom song requests (advance notice required)",
    "PA hire for speeches: £150"
  ];

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Pricing & Packages</h1>
            <p className="text-xl text-gray-400 mb-2">Transparent pricing for quality entertainment</p>
            <p className="text-gray-500">All prices are approximate and can be tailored to your needs</p>
          </motion.div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {packages.map((pkg, index) => (
            <motion.div
              key={pkg.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className={`bg-white/5 backdrop-blur-sm border-white/10 h-full relative overflow-hidden ${pkg.popular ? 'ring-2 ring-orange-500' : ''}`}>
                {pkg.popular && (
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
                      Most Popular
                    </Badge>
                  </div>
                )}
                
                <CardHeader>
                  <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${pkg.color} flex items-center justify-center mb-4`}>
                    <Music className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-white text-2xl mb-2">{pkg.name}</CardTitle>
                  <p className="text-gray-400 text-sm mb-4">{pkg.description}</p>
                  <div className="space-y-2">
                    <div className="flex items-baseline gap-2">
                      <PoundSterling className="w-5 h-5 text-green-400" />
                      <span className="text-3xl font-bold text-white">{pkg.price}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">{pkg.duration}</span>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <ul className="space-y-3">
                    {pkg.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-gray-300">
                        <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Additional Services */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <Card className="bg-white/5 backdrop-blur-sm border-blue-500/20 mb-12">
            <CardHeader>
              <CardTitle className="text-white text-2xl">Additional Services & Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {additionalServices.map((service, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-gray-300">
                    <Check className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <span>{service}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="bg-gradient-to-r from-green-500/20 to-orange-500/20 rounded-2xl p-8 border border-green-500/30 text-center"
        >
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Book?</h2>
          <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
            Get in touch for a custom quote tailored to your event. We're happy to discuss your specific needs and create a package that works for you.
          </p>
          <a href={createPageUrl("Contact")}>
            <Button size="lg" className="bg-gradient-to-r from-green-500 to-orange-500 hover:from-green-600 hover:to-orange-600 text-white px-8 py-6 text-lg">
              <Mail className="w-5 h-5 mr-2" />
              Contact Us
            </Button>
          </a>
        </motion.div>
      </div>
    </div>
  );
}
