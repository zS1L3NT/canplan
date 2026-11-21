import React from 'react';
import { TabStack } from '../../../ui/TabStack';

export const unstable_settings = {
  anchor: 'updates',
};

export default function UpdatesStackLayout() {
  return <TabStack rootName="updates" rootTitle="Updates" />;
}
