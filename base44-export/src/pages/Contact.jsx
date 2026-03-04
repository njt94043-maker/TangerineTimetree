
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Send, CheckCircle2, Loader2, Phone, MapPin } from "lucide-react";
import { motion } from "framer-motion";

export default function Contact() {
  // Add SEO meta tags
  useEffect(() => {
    document.title = "Contact Us | Book The Green Tangerine - South Wales Function Band";
    
    const metaDescription = document.querySelector('meta[name="description"]');
    const descriptionContent = 'Book The Green Tangerine for your venue or event in Cardiff, Swansea, Bridgend, Neath, or across South Wales. Contact us today for availability and pricing. We reply within 24 hours.';
    
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
      { property: 'og:title', content: 'Contact Us | Book The Green Tangerine' },
      { property: 'og:description', content: 'Book South Wales\' premier function band for your venue or event. Professional, reliable entertainment across Cardiff, Swansea, Bridgend & beyond.' },
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

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    eventType: "",
    eventDate: "",
    venue: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await base44.integrations.Core.SendEmail({
        to: "thegreentangerine01@gmail.com",
        subject: `New Booking Enquiry from ${formData.name}`,
        body: `
          New booking enquiry received:
          
          Name: ${formData.name}
          Email: ${formData.email}
          Phone: ${formData.phone || 'Not provided'}
          Venue/Location: ${formData.venue || 'Not specified'}
          Event Type: ${formData.eventType || 'Not specified'}
          Event Date: ${formData.eventDate || 'Not specified'}
          
          Message:
          ${formData.message}
          
          ---
          Reply to: ${formData.email}
        `
      });

      setSubmitted(true);
      setFormData({
        name: "",
        email: "",
        phone: "",
        eventType: "",
        eventDate: "",
        venue: "",
        message: ""
      });
    } catch (error) {
      alert("Failed to send message. Please try emailing us directly at thegreentangerine01@gmail.com");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen py-12 flex items-center justify-center">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <Card className="bg-white/5 backdrop-blur-sm border-green-500/20">
              <CardContent className="py-12">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-white mb-4">Thanks for Getting in Touch!</h2>
                <p className="text-gray-300 mb-6">
                  We've received your enquiry and will respond within 24 hours. 
                  Looking forward to making your event in South Wales unforgettable!
                </p>
                <Button
                  onClick={() => setSubmitted(false)}
                  className="bg-gradient-to-r from-green-500 to-orange-500"
                >
                  Send Another Message
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Get In Touch</h1>
            <p className="text-xl text-gray-400">Ready to book? Let's talk about your event in Cardiff, Swansea, Bridgend, or across South Wales</p>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-white/5 backdrop-blur-sm border-green-500/20">
            <CardContent className="pt-6 text-center">
              <Mail className="w-8 h-8 text-green-500 mx-auto mb-3" />
              <h3 className="text-white font-semibold mb-2">Email</h3>
              <a href="mailto:thegreentangerine01@gmail.com" className="text-gray-400 hover:text-green-400 text-sm break-all">
                thegreentangerine01@gmail.com
              </a>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-sm border-orange-500/20">
            <CardContent className="pt-6 text-center">
              <Phone className="w-8 h-8 text-orange-500 mx-auto mb-3" />
              <h3 className="text-white font-semibold mb-2">Phone</h3>
              <p className="text-gray-400 text-sm">Available on request</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-sm border-blue-500/20">
            <CardContent className="pt-6 text-center">
              <MapPin className="w-8 h-8 text-blue-500 mx-auto mb-3" />
              <h3 className="text-white font-semibold mb-2">Based In</h3>
              <p className="text-gray-400 text-sm">Rhondda, South Wales</p>
              <p className="text-gray-500 text-xs mt-1">Covering all South Wales</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white/5 backdrop-blur-sm border-green-500/20">
          <CardHeader>
            <CardTitle className="text-white text-2xl">Send Us a Message</CardTitle>
            <p className="text-gray-400 text-sm">Fill in the form below and we'll get back to you within 24 hours</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-gray-300">Your Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                    className="bg-white/5 border-white/10 text-white"
                    placeholder="John Smith"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-300">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    required
                    className="bg-white/5 border-white/10 text-white"
                    placeholder="john@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-gray-300">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="bg-white/5 border-white/10 text-white"
                    placeholder="07123 456789"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="venue" className="text-gray-300">Venue / Location</Label>
                  <Input
                    id="venue"
                    value={formData.venue}
                    onChange={(e) => setFormData({...formData, venue: e.target.value})}
                    className="bg-white/5 border-white/10 text-white"
                    placeholder="e.g., Cardiff, Swansea, Bridgend..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="eventType" className="text-gray-300">Event Type</Label>
                  <Input
                    id="eventType"
                    value={formData.eventType}
                    onChange={(e) => setFormData({...formData, eventType: e.target.value})}
                    className="bg-white/5 border-white/10 text-white"
                    placeholder="Wedding, Party, Pub Gig..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="eventDate" className="text-gray-300">Event Date (if known)</Label>
                  <Input
                    id="eventDate"
                    type="date"
                    value={formData.eventDate}
                    onChange={(e) => setFormData({...formData, eventDate: e.target.value})}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message" className="text-gray-300">Your Message *</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  required
                  rows={6}
                  className="bg-white/5 border-white/10 text-white"
                  placeholder="Tell us about your event..."
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-green-500 to-orange-500 hover:from-green-600 hover:to-orange-600 text-white py-6 text-lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Send Message
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Social Proof */}
        <Card className="bg-gradient-to-r from-green-500/10 to-orange-500/10 border-green-500/20 mt-8">
          <CardContent className="py-6 text-center">
            <p className="text-gray-300 mb-2">
              ⭐⭐⭐⭐⭐ <strong className="text-white">100% Recommended</strong> by venues across South Wales
            </p>
            <p className="text-sm text-gray-400">
              Professional • Reliable • Crowd-Pleasing
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
