import React, { useState } from 'react';
import { View, Text, Image, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Drawer } from 'expo-router/drawer';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '../../src/theme';
import { AppTutorial } from '../../src/components/AppTutorial';

interface NavItem {
  icon: string;
  label: string;
  route: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Calendar',
    items: [
      { icon: '\uD83D\uDCC5', label: 'Gigs', route: 'index' },
    ],
  },
  {
    title: 'Business',
    items: [
      { icon: '\uD83D\uDCCA', label: 'Dashboard', route: 'dashboard' },
      { icon: '\uD83D\uDCC4', label: 'Invoices', route: 'invoices' },
      { icon: '\uD83D\uDCDD', label: 'Quotes', route: 'quotes' },
      { icon: '\uD83D\uDC65', label: 'Clients', route: 'clients' },
      { icon: '\uD83C\uDFE2', label: 'Venues', route: 'venues' },
    ],
  },
  {
    title: 'Music',
    items: [
      { icon: '\uD83C\uDFB5', label: 'Songs', route: 'songs' },
      { icon: '\uD83C\uDFB6', label: 'Setlists', route: 'setlists' },
    ],
  },
  {
    title: 'Performance',
    items: [
      { icon: '\uD83C\uDFAF', label: 'Live Mode', route: 'live' },
      { icon: '\uD83C\uDFA7', label: 'Practice', route: 'practice' },
    ],
  },
];

const FOOTER_ITEMS: NavItem[] = [
  { icon: '\u2699\uFE0F', label: 'Settings', route: 'settings' },
];

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const insets = useSafeAreaInsets();
  const { state, navigation } = props;
  const currentRoute = state.routes[state.index]?.name ?? '';
  const [showTutorial, setShowTutorial] = useState(false);

  function navigateTo(route: string) {
    navigation.navigate(route);
    navigation.closeDrawer();
  }

  return (
    <View style={[styles.drawerContainer, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.drawerHeader}>
        <Image source={require('../../assets/logo-512.png')} style={styles.logoImg} />
        <View>
          <Text style={styles.logoGreen}>Tangerine</Text>
          <Text style={styles.logoOrange}>Timetree</Text>
        </View>
      </View>

      {/* Nav sections */}
      <ScrollView style={styles.drawerNav} showsVerticalScrollIndicator={false}>
        {NAV_SECTIONS.map(section => (
          <View key={section.title}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.items.map(item => {
              const isActive = currentRoute === item.route;
              return (
                <Pressable
                  key={item.route}
                  style={[styles.drawerItem, isActive && styles.drawerItemActive]}
                  onPress={() => navigateTo(item.route)}
                >
                  <Text style={styles.drawerIcon}>{item.icon}</Text>
                  <Text style={[styles.drawerLabel, isActive && styles.drawerLabelActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.drawerFooter, { paddingBottom: insets.bottom + 8 }]}>
        <Pressable
          style={styles.drawerItem}
          onPress={() => { navigation.closeDrawer(); setShowTutorial(true); }}
        >
          <Text style={styles.drawerIcon}>{'\uD83C\uDF93'}</Text>
          <Text style={styles.drawerLabel}>App Guide</Text>
        </Pressable>
        {FOOTER_ITEMS.map(item => {
          const isActive = currentRoute === item.route;
          return (
            <Pressable
              key={item.route}
              style={[styles.drawerItem, isActive && styles.drawerItemActive]}
              onPress={() => navigateTo(item.route)}
            >
              <Text style={styles.drawerIcon}>{item.icon}</Text>
              <Text style={[styles.drawerLabel, isActive && styles.drawerLabelActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <AppTutorial visible={showTutorial} onClose={() => setShowTutorial(false)} />
    </View>
  );
}

export default function DrawerLayout() {
  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: COLORS.card,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.04)',
        },
        headerTintColor: COLORS.green,
        headerTitleStyle: {
          fontFamily: FONTS.bodyBold,
          fontSize: 15,
          color: COLORS.text,
        },
        drawerStyle: {
          backgroundColor: COLORS.card,
          width: 280,
        },
        sceneStyle: {
          backgroundColor: COLORS.background,
        },
      }}
    >
      <Drawer.Screen
        name="index"
        options={{ title: 'Gigs' }}
      />
      <Drawer.Screen
        name="dashboard"
        options={{ title: 'Dashboard' }}
      />
      <Drawer.Screen
        name="invoices"
        options={{ title: 'Invoices' }}
      />
      <Drawer.Screen
        name="quotes"
        options={{ title: 'Quotes' }}
      />
      <Drawer.Screen
        name="clients"
        options={{ title: 'Clients' }}
      />
      <Drawer.Screen
        name="venues"
        options={{ title: 'Venues' }}
      />
      <Drawer.Screen
        name="songs"
        options={{ title: 'Songs' }}
      />
      <Drawer.Screen
        name="setlists"
        options={{ title: 'Setlists' }}
      />
      <Drawer.Screen
        name="live"
        options={{ title: 'Live Mode', headerShown: false }}
      />
      <Drawer.Screen
        name="practice"
        options={{ title: 'Practice', headerShown: false }}
      />
      <Drawer.Screen
        name="settings"
        options={{ title: 'Settings' }}
      />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  drawerContainer: {
    flex: 1,
    backgroundColor: COLORS.card,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  logoImg: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  logoGreen: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.green,
  },
  logoOrange: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.orange,
  },
  drawerNav: {
    flex: 1,
    paddingTop: 8,
  },
  sectionTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: COLORS.textMuted,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  drawerItemActive: {
    borderLeftColor: COLORS.green,
    backgroundColor: 'rgba(0,230,118,0.05)',
  },
  drawerIcon: {
    fontSize: 18,
    width: 22,
    textAlign: 'center',
  },
  drawerLabel: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textDim,
  },
  drawerLabelActive: {
    color: COLORS.green,
    fontFamily: FONTS.bodyBold,
  },
  drawerFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    paddingTop: 8,
  },
});
