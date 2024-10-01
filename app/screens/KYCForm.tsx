import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { StackNavigationProp } from '@react-navigation/stack';
import { TabParamList } from '../(tabs)/index'; // Adjust the path accordingly
import { View, Text, Image, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { storage, db } from '../firebase'; // Firebase configuration
import { FaceClient } from "@azure/cognitiveservices-face";
import { ApiKeyCredentials } from "@azure/ms-rest-js";

// Azure Vision API Key & Endpoint
const AZURE_VISION_API_KEY = 'f59e83cdd6124f35af74d13c0efa90ba';
const AZURE_VISION_ENDPOINT = 'https://outrscvsdfhvvc.cognitiveservices.azure.com/';
// Azure Face API Key & Endpoint
const AZURE_FACE_API_KEY = 'ec76a3a0de124f4ba973c3c3758e6044';
const AZURE_FACE_ENDPOINT = 'https://hfdhfdhjhjefdhjfjd.cognitiveservices.azure.com/';

// Initialize Azure Face API Client
const credentials = new ApiKeyCredentials({ inHeader: { 'Ocp-Apim-Subscription-Key': AZURE_FACE_API_KEY } });
const faceClient = new FaceClient(credentials, AZURE_FACE_ENDPOINT);

// Custom Modal Component for Alerts
type CustomAlertModalProps = {
  visible: boolean;
  message: string;
  onClose: () => void;
};

const CustomAlertModal: React.FC<CustomAlertModalProps> = ({ visible, message, onClose }) => {
  return (
    <Modal visible={visible} transparent={true} animationType="slide">
      <View style={styles.modalView}>
        <Text style={styles.modalText}>{message}</Text>
        <TouchableOpacity style={styles.modalButton} onPress={onClose}>
          <Text style={styles.modalButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

export default function KYCForm() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [idCardNumber, setIdCardNumber] = useState('');
  const [idImage, setIdImage] = useState<string | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [expirationDate, setExpirationDate] = useState<string | null>(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [isValidCard, setIsValidCard] = useState<boolean | null>(null);
  const [faceIdFromID, setFaceIdFromID] = useState<string | null>(null);
  const [matchScore, setMatchScore] = useState<number | null>(null);
  
  type KYCFormNavigationProp = CompositeNavigationProp<
    BottomTabNavigationProp<TabParamList, 'KYCForm'>,
    StackNavigationProp<TabParamList>
  >;

  const navigation = useNavigation<KYCFormNavigationProp>();

  // Function to pick an ID image from the gallery and detect face
  // Function to pick an ID image from the gallery and detect face
  const pickImageFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setIdImage(uri);

      try {
        const faceId = await detectFace(uri); // Detect face from the ID card
        setFaceIdFromID(faceId); // Set detected face ID
        await extractTextFromImage(uri); // Extract text after image is picked
      } catch (error) {
        setAlertMessage('No face detected in the ID image.');
        setAlertVisible(true);
      }
    }
  };

  interface Word {
    text: string;
  }

  interface Line {
    words: Word[];
  }

  interface Region {
    lines: Line[];
  }

  interface OcrResult {
    regions: Region[];
  }

  const extractTextFromImage = async (uri: string) => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
  
      const ocrResponse = await fetch(`${AZURE_VISION_ENDPOINT}/vision/v3.2/ocr`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_VISION_API_KEY,
          'Content-Type': 'application/octet-stream',
        },
        body: blob,
      });
  
      const result: OcrResult = await ocrResponse.json();
  
      if (!ocrResponse.ok) {
        setAlertMessage('Failed to extract text from image.');
        setAlertVisible(true);
      } else {
        const fullText = result.regions
          .flatMap((region) =>
            region.lines.map((line) =>
              line.words.map((word) => word.text).join(' ')
            ).join('\n')
          ).join('\n');
  
        console.log("Extracted Text:", fullText);
        setExtractedText(fullText);
        extractExpirationDate(fullText);
      }
    } catch (error) {
      console.error('Error extracting text:', error);
      setAlertMessage('Failed to extract text from image.');
      setAlertVisible(true);
    }
  };
  
  const extractExpirationDate = (text: string) => {
    console.log("Full Extracted Text:", text); // Log the full text for debugging
  
    // Regex to capture dates in dd.mm.yyyy format
    const pattern = /(\d{2}[.\s/-]\d{2}[.\s/-]\d{4})/g; // Global flag to capture multiple matches
    const matches = text.match(pattern);
  
    if (matches && matches.length >= 2) {
      // Get the second match as the expiration date
      const expirationDate = matches[1]; // Second date (index 1)
      setExpirationDate(expirationDate);
      console.log("Extracted Expiration Date:", expirationDate); // Log the expiration date
      const isValid = compareDates(expirationDate);
      setIsValidCard(isValid); // Set validity based on the expiration date
    } else {
      console.error('Expiration date not found');
      setAlertMessage('Expiration date not found in the text.');
      setAlertVisible(true);
    }
  };
  
  const detectFace = async (imageUri: string) => {
    try {
        console.log('Detecting face from image:', imageUri); // Log the image URI
        const response = await fetch(imageUri);
        const blob = await response.blob();

        const faceApiResponse = await fetch(`${AZURE_FACE_ENDPOINT}/face/v1.0/detect`, {
            method: 'POST',
            headers: {
                'Ocp-Apim-Subscription-Key': AZURE_FACE_API_KEY,
                'Content-Type': 'application/octet-stream',
            },
            body: blob,
        });

        if (!faceApiResponse.ok) {
            const errorResponse = await faceApiResponse.text();
            console.error('Face API error:', errorResponse);
            throw new Error(`Face detection API error: ${faceApiResponse.status} ${faceApiResponse.statusText}`);
          }

        const faceData = await faceApiResponse.json();
        if (faceData.length === 0) {
            throw new Error('No face detected in the image.');
        }

        return faceData[0].faceId;
    } catch (error) {
        console.error('Error detecting face:', error);
        throw error; // Re-throw error for handling in the caller
    }
};

const compareFaces = async (faceId1: string, faceId2: string) => {
    try {
        console.log('Comparing faces:', faceId1, faceId2); // Log the face IDs being compared
        const comparisonResult = await faceClient.face.verifyFaceToFace(faceId1, faceId2);
        setMatchScore(comparisonResult.confidence);
        return comparisonResult.confidence; // Ensure this returns a valid confidence score
    } catch (error) {
        console.error('Error comparing faces:', error);
        setAlertMessage('Failed to compare faces. Please try again.');
        setAlertVisible(true);
        return undefined; // Explicitly return undefined in case of an error
    }
};

const takeSelfieAndCompare = async (idFaceId: string) => {
    let result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
    });

    if (!result.canceled) {
        const uri = result.assets[0].uri;
        setSelfieImage(uri);

        try {
            const selfieFaceId = await detectFace(uri);
            if (!selfieFaceId) {
                setAlertMessage('Face detection failed. Please try again.');
                setAlertVisible(true);
                return; // Early return if face detection fails
            }

            const confidence = await compareFaces(idFaceId, selfieFaceId);
            if (confidence !== undefined) {
                if (confidence >= 0.7) {
                    setAlertMessage('Face match successful! KYC validated.');
                    setIsValidCard(true);
                } else {
                    setAlertMessage('Face match failed. Please try again or improve image quality.');
                    setIsValidCard(false);
                }
                setAlertVisible(true);
            } else {
                setAlertMessage('Error during face comparison. Please try again.');
                setAlertVisible(true);
            }
        } catch (error:any) {
            console.error("Error in face detection or comparison:", error);
            if (error.message.includes("detecting face")) {
                setAlertMessage('Face detection error. Please ensure the image is clear.');
            } else if (error.message.includes("comparing faces")) {
                setAlertMessage('Face comparison error. Please try again.');
            } else {
                setAlertMessage('An unexpected error occurred. Please try again.');
            }
            setAlertVisible(true);
        }
    }
};

  
  const submitKYC = async () => {
    if (!fullName || !idCardNumber || !email || !idImage || !selfieImage) {
      setAlertMessage('Please fill out all fields and upload images.');
      setAlertVisible(true);
      return;
    }

    if (!isValidCard) {
      setAlertMessage('Please validate your ID card first.');
      setAlertVisible(true);
      return;
    }

    try {
      const idImageRef = ref(storage, 'idImages/${idCardNumber}.jpg');
      await uploadBytes(idImageRef, await fetch(idImage).then(res => res.blob()));
      const selfieImageRef = ref(storage, 'selfies/${idCardNumber}.jpg');
      await uploadBytes(selfieImageRef, await fetch(selfieImage).then(res => res.blob()));

      await addDoc(collection(db, 'kyc_records'), {
        fullName,
        email,
        idCardNumber,
        idImage: await getDownloadURL(idImageRef),
        selfieImage: await getDownloadURL(selfieImageRef),
        expirationDate,
        createdAt: new Date(),
      });

      setAlertMessage('KYC submission successful!');
      setAlertVisible(true);
    } catch (error) {
      console.error('Error submitting KYC:', error);
      setAlertMessage('KYC submission failed. Please try again.');
      setAlertVisible(true);
    }
  };

  const compareDates = (expirationDate: string) => {
    const today = new Date();
    const expDate = new Date(expirationDate.replace(/-/g, '/'));  // <== potential issue
    return expDate > today;
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>KYC Form</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Full Name"
        value={fullName}
        onChangeText={setFullName}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="ID Card Number"
        value={idCardNumber}
        onChangeText={setIdCardNumber}
      />
      <TouchableOpacity onPress={pickImageFromGallery} style={styles.button}>
  <Text style={styles.buttonText}>{idImage ? 'Change ID Image' : 'Upload ID Image'}</Text>
</TouchableOpacity>
{idImage && <Image source={{ uri: idImage }} style={styles.image} />}
{isValidCard !== null && (
  <Text style={[styles.cardValidityText, { color: isValidCard ? 'green' : 'red' }]}>
    {isValidCard ? 'Valid Card' : 'Invalid Card'}
  </Text>
)}
      
      <TouchableOpacity onPress={() => takeSelfieAndCompare(faceIdFromID || '')} style={styles.button}>
        <Text style={styles.buttonText}>{selfieImage ? 'Change Selfie' : 'Take Selfie'}</Text>
      </TouchableOpacity>
      {selfieImage && <Image source={{ uri: selfieImage }} style={styles.image} />}
      
      <TouchableOpacity onPress={submitKYC} style={styles.button}>
        <Text style={styles.buttonText}>Submit KYC</Text>
      </TouchableOpacity>
      
      <CustomAlertModal
        visible={alertVisible}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  button: {
    backgroundColor: '#007BFF',
    padding: 15,
    borderRadius: 5,
    marginBottom: 15,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
  },
  image: {
    width: '100%',
    height: 200,
    marginBottom: 15,
    borderRadius: 5,
  },
  modalView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalText: {
    color: '#fff',
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: '#007BFF',
    padding: 10,
    borderRadius: 5,
  },
  modalButtonText: {
    color: '#fff',
  },
  cardValidityText: {
    fontSize: 18,
    marginTop: 10,
  },
});