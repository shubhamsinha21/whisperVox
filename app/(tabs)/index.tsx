import { ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function HomeScreen() {

  const initializeModel = async (model:string = "baseModel") => {
    try {
      // init whisper model passing ,model id
      console.log(`Initializing model: ${model}`);
    } catch (error) {
      console.error("Error initializing model:", error);
    }// await loadModel();
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior='automatic'
      contentContainerStyle={{flex:1}}>
    <ThemedView>
      <ThemedText>Hello</ThemedText>
    </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});
