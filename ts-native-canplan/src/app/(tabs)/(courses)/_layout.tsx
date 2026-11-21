import React from 'react';
import { TabStack } from '../../../ui/TabStack';

export const unstable_settings = {
  anchor: 'courses',
};

export default function CoursesStackLayout() {
  return <TabStack rootName="courses" rootTitle="Courses" />;
}
