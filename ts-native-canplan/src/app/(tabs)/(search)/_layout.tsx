import React from 'react';
import { TabStack } from '../../../ui/TabStack';

export const unstable_settings = {
  anchor: 'search',
};

export default function SearchStackLayout() {
  return <TabStack rootName="search" rootTitle="Search" />;
}
