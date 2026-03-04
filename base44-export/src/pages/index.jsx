import Layout from "./Layout.jsx";

import Home from "./Home";

import Photos from "./Photos";

import Videos from "./Videos";

import Dashboard from "./Dashboard";

import Bookings from "./Bookings";

import Availability from "./Availability";

import ManagePhotos from "./ManagePhotos";

import ManageVideos from "./ManageVideos";

import Analytics from "./Analytics";

import SetList from "./SetList";

import SongMixer from "./SongMixer";

import CustomizeApp from "./CustomizeApp";

import Pricing from "./Pricing";

import Contact from "./Contact";

import MerchShop from "./MerchShop";

import Profile from "./Profile";

import ActivityLog from "./ActivityLog";

import Expenses from "./Expenses";

import BandManagement from "./BandManagement";

import ManageUsers from "./ManageUsers";

import BandFinances from "./BandFinances";

import BandInvoices from "./BandInvoices";

import ManageMerch from "./ManageMerch";

import ForVenues from "./ForVenues";

import Files from "./Files";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    Home: Home,
    
    Photos: Photos,
    
    Videos: Videos,
    
    Dashboard: Dashboard,
    
    Bookings: Bookings,
    
    Availability: Availability,
    
    ManagePhotos: ManagePhotos,
    
    ManageVideos: ManageVideos,
    
    Analytics: Analytics,
    
    SetList: SetList,
    
    SongMixer: SongMixer,
    
    CustomizeApp: CustomizeApp,
    
    Pricing: Pricing,
    
    Contact: Contact,
    
    MerchShop: MerchShop,
    
    Profile: Profile,
    
    ActivityLog: ActivityLog,
    
    Expenses: Expenses,
    
    BandManagement: BandManagement,
    
    ManageUsers: ManageUsers,
    
    BandFinances: BandFinances,
    
    BandInvoices: BandInvoices,
    
    ManageMerch: ManageMerch,
    
    ForVenues: ForVenues,
    
    Files: Files,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Home />} />
                
                
                <Route path="/Home" element={<Home />} />
                
                <Route path="/Photos" element={<Photos />} />
                
                <Route path="/Videos" element={<Videos />} />
                
                <Route path="/Dashboard" element={<Dashboard />} />
                
                <Route path="/Bookings" element={<Bookings />} />
                
                <Route path="/Availability" element={<Availability />} />
                
                <Route path="/ManagePhotos" element={<ManagePhotos />} />
                
                <Route path="/ManageVideos" element={<ManageVideos />} />
                
                <Route path="/Analytics" element={<Analytics />} />
                
                <Route path="/SetList" element={<SetList />} />
                
                <Route path="/SongMixer" element={<SongMixer />} />
                
                <Route path="/CustomizeApp" element={<CustomizeApp />} />
                
                <Route path="/Pricing" element={<Pricing />} />
                
                <Route path="/Contact" element={<Contact />} />
                
                <Route path="/MerchShop" element={<MerchShop />} />
                
                <Route path="/Profile" element={<Profile />} />
                
                <Route path="/ActivityLog" element={<ActivityLog />} />
                
                <Route path="/Expenses" element={<Expenses />} />
                
                <Route path="/BandManagement" element={<BandManagement />} />
                
                <Route path="/ManageUsers" element={<ManageUsers />} />
                
                <Route path="/BandFinances" element={<BandFinances />} />
                
                <Route path="/BandInvoices" element={<BandInvoices />} />
                
                <Route path="/ManageMerch" element={<ManageMerch />} />
                
                <Route path="/ForVenues" element={<ForVenues />} />
                
                <Route path="/Files" element={<Files />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}