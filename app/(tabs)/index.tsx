import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import KYCForm from '../screens/KYCForm';

const Tab = createBottomTabNavigator();
export type TabParamList = {
  Home: undefined; // No parameters expected for Home
  KYCForm: undefined; // No parameters expected for KYCForm
};

export default function Tabs() {
  return (
    <Tab.Navigator initialRouteName="Home">
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="KYCForm" component={KYCForm} />
    </Tab.Navigator>
  );
}
