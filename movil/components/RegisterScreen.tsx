import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker'; 
import { Feather } from '@expo/vector-icons'; // <-- Importación para el ícono del calendario
import { api } from './context/AuthContext';

export default function RegisterScreen() {
  const router = useRouter();
  
  const [nombre, setNombre] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [perfil, setPerfil] = useState('cliente'); 

  // Estados para el calendario y las fechas
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [fechaVisual, setFechaVisual] = useState(''); // DD/MM/AAAA (Para la pantalla)
  const [fechaBackend, setFechaBackend] = useState(''); // AAAA-MM-DD (Para PostgreSQL)

  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 1. Manejar cuando el usuario ESCRIBE la fecha a mano
  const handleDateTextChange = (text: string) => {
    // Dejar solo números
    let cleaned = text.replace(/[^0-9]/g, '');

    // Agregar diagonales automáticamente
    let formatted = cleaned;
    if (cleaned.length > 2) {
      formatted = cleaned.substring(0, 2) + '/' + cleaned.substring(2);
    }
    if (cleaned.length > 4) {
      formatted = formatted.substring(0, 5) + '/' + cleaned.substring(4, 8);
    }

    setFechaVisual(formatted);
    setErrorMessage('');

    // Si ya completó los 10 caracteres (DD/MM/AAAA)
    if (formatted.length === 10) {
      const [day, month, year] = formatted.split('/');
      setFechaBackend(`${year}-${month}-${day}`); // Para la BD
      
      // Sincronizar el calendario interno
      const parsedYear = parseInt(year);
      const parsedMonth = parseInt(month) - 1; 
      const parsedDay = parseInt(day);
      if (parsedYear > 1900 && parsedYear <= new Date().getFullYear()) {
        setDate(new Date(parsedYear, parsedMonth, parsedDay));
      }
    } else {
      setFechaBackend(''); // Si está incompleto, no mandamos nada a la BD
    }
  };

  // 2. Manejar cuando el usuario USA EL CALENDARIO
  const onChangeDate = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios'); 
    
    if (selectedDate) {
      setDate(selectedDate);
      
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const year = selectedDate.getFullYear();

      setFechaVisual(`${day}/${month}/${year}`); 
      setFechaBackend(`${year}-${month}-${day}`); 
      setErrorMessage('');
    }
  };

  const handleRegister = async () => {
    if (!nombre || !apellidos || !email || !password || !telefono) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios.');
      return;
    }

    if (!fechaBackend) {
      Alert.alert('Error', 'Por favor ingresa una fecha de nacimiento válida (DD/MM/AAAA).');
      return;
    }

    setIsLoading(true);

    try {
      // Realizamos la llamada utilizando la instancia centralizada de Axios
      const response = await api.post('/api/register', {
        nombre: nombre,
        apellidos: apellidos, 
        telefono: telefono,
        email: email,
        fechaNacimiento: fechaBackend, 
        password: password,
        perfil: perfil === 'tecnico' ? 2 : 1 
      });

      const data = response.data;

      setIsLoading(false);
      router.push({
        pathname: '/verify-screen',
        params: { userEmail: email }
      } as any);

    } catch (error: any) {
      setIsLoading(false);
      console.error(error);
      
      const errMessage = error.response?.data?.error || 'No se pudo conectar con el servidor de Click & Serve.';

      if (error.response?.data?.error === 'Usuario Existente') {
        Alert.alert(
          'Usuario Existente',
          'Este correo electrónico ya se encuentra registrado en el sistema.',
          [
            { 
              text: 'OK', 
              // Redirige al LoginScreen (que es tu ruta raíz "/")
              onPress: () => router.replace('/') 
            }
          ]
        );
      } else {
        // Cualquier otro tipo de error (campos inválidos, error de red, etc.)
        Alert.alert('Error en el registro', errMessage);
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          
          <View style={styles.headerContainer}>
            <Text style={styles.title}>Crear Cuenta</Text>
            <Text style={styles.subtitle}>Únete a la red de servicios en Lázaro Cárdenas</Text>
          </View>

          <View style={styles.card}>
            
            <View style={styles.row}>
              <View style={styles.halfInputContainer}>
                <Text style={styles.label}>NOMBRE</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. Juan"
                  value={nombre}
                  onChangeText={(text) => { setNombre(text); setErrorMessage(''); }}
                  selectionColor="#001b3a"
                />
              </View>
              <View style={styles.halfInputContainer}>
                <Text style={styles.label}>APELLIDOS</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. Pérez"
                  value={apellidos}
                  onChangeText={(text) => { setApellidos(text); setErrorMessage(''); }}
                  selectionColor="#001b3a"
                />
              </View>
            </View>

            <Text style={styles.label}>TELÉFONO</Text>
            <TextInput
              style={styles.input}
              placeholder="10 dígitos"
              keyboardType="phone-pad"
              value={telefono}
              onChangeText={(text) => { setTelefono(text); setErrorMessage(''); }}
              selectionColor="#001b3a"
            />

            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="tu@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={(text) => { setEmail(text); setErrorMessage(''); }}
              selectionColor="#001b3a"
            />

            <Text style={styles.label}>FECHA DE NACIMIENTO</Text>
            {/* Contenedor Híbrido: Input + Ícono */}
            <View style={styles.dateInputContainer}>
              <TextInput
                style={styles.dateTextInput}
                placeholder="DD/MM/AAAA"
                placeholderTextColor="#9CA8B6"
                keyboardType="numeric"
                maxLength={10}
                value={fechaVisual}
                onChangeText={handleDateTextChange}
                selectionColor="#001b3a"
              />
              
              <TouchableOpacity 
                style={styles.calendarIcon} 
                onPress={() => setShowDatePicker(true)}
              >
                <Feather name="calendar" size={20} color="#7A8C9E" />
              </TouchableOpacity>
            </View>

            {/* Componente del Calendario (Oculto por defecto) */}
            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display="default"
                onChange={onChangeDate}
                maximumDate={new Date()} 
              />
            )}

            <Text style={styles.label}>CONTRASEÑA</Text>
            <TextInput
              style={styles.input}
              placeholder="********"
              secureTextEntry
              value={password}
              onChangeText={(text) => { setPassword(text); setErrorMessage(''); }}
              selectionColor="#001b3a"
            />

            <Text style={styles.label}>TIPO DE PERFIL</Text>
            <View style={styles.profileRow}>
              <TouchableOpacity 
                style={[styles.profileButton, perfil === 'cliente' && styles.profileButtonActive]}
                onPress={() => setPerfil('cliente')}
              >
                <Text style={[styles.profileButtonText, perfil === 'cliente' && styles.profileButtonTextActive]}>CLIENTE</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.profileButton, perfil === 'tecnico' && styles.profileButtonActive]}
                onPress={() => setPerfil('tecnico')}
              >
                <Text style={[styles.profileButtonText, perfil === 'tecnico' && styles.profileButtonTextActive]}>TÉCNICO</Text>
              </TouchableOpacity>
            </View>

            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}

            <TouchableOpacity 
              style={[styles.button, isLoading && { backgroundColor: '#5B708B' }]} 
              onPress={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>REGISTRARME</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.loginContainer} onPress={() => router.back()}>
              <Text style={styles.loginText}>¿Ya tienes una cuenta? <Text style={styles.loginTextBold}>Inicia sesión</Text></Text>
            </TouchableOpacity>

          </View>
          
          <Text style={styles.footerText}>CLICK&SERVE © 2026</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAFAFA' },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 40 },
  headerContainer: { alignItems: 'center', marginBottom: 30 },
  title: { fontSize: 34, fontWeight: '700', color: '#0A192F', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', marginBottom: 8 },
  subtitle: { fontSize: 14, fontStyle: 'italic', color: '#7A8C9E' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  halfInputContainer: { width: '47%' },
  label: { fontSize: 11, color: '#5B708B', fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 10 },
  input: { borderBottomWidth: 1, borderBottomColor: '#D1D9E0', fontSize: 15, paddingVertical: 8, color: '#0A192F', marginBottom: 15 },
  
  // NUEVOS ESTILOS PARA LA FECHA
  dateInputContainer: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#D1D9E0', marginBottom: 15 },
  dateTextInput: { flex: 1, fontSize: 15, paddingVertical: 8, color: '#0A192F' },
  calendarIcon: { padding: 10 },
  
  profileRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, marginBottom: 25 },
  profileButton: { flex: 1, paddingVertical: 12, borderWidth: 1, borderColor: '#D1D9E0', alignItems: 'center', marginHorizontal: 5 },
  profileButtonActive: { backgroundColor: '#000000', borderColor: '#000000' },
  profileButtonText: { color: '#5B708B', fontWeight: 'bold', fontSize: 12, letterSpacing: 1 },
  profileButtonTextActive: { color: '#FFFFFF' },
  button: { backgroundColor: '#0A192F', paddingVertical: 16, borderRadius: 2, alignItems: 'center', marginBottom: 20 },
  buttonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14, letterSpacing: 1 },
  loginContainer: { alignItems: 'center', marginTop: 10 },
  loginText: { color: '#7A8C9E', fontSize: 14 },
  loginTextBold: { fontWeight: 'bold', color: '#0A192F' },
  footerText: { textAlign: 'center', color: '#D1D9E0', fontSize: 10, letterSpacing: 1, marginTop: 10 },
  errorText: { color: '#D9534F', fontSize: 13, textAlign: 'center', marginBottom: 15, fontWeight: 'bold' }
});