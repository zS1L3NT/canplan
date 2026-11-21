import React from 'react';
import { TabStack } from '../../../ui/TabStack';

export const unstable_settings = {
  anchor: 'index',
};

export default function TasksStackLayout() {
  return <TabStack rootName="index" rootTitle="Tasks" />;
}
