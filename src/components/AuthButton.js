import React from 'react';
import { TouchableOpacity, Text, View, Image, StyleSheet } from 'react-native';
import { signInWithGoogle, signOutUser } from '../firebase';

export default function AuthButton({ user }) {
  if (user) {
    return (
      <View style={styles.row}>
        {user.photoURL ? (
          <Image source={{ uri: user.photoURL }} style={styles.avatar} />
        ) : null}
        <Text style={styles.name} numberOfLines={1}>{user.displayName ?? user.email}</Text>
        <TouchableOpacity style={styles.btn} onPress={signOutUser}>
          <Text style={styles.btnText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity style={[styles.btn, styles.googleBtn]} onPress={signInWithGoogle}>
      <Text style={styles.btnText}>Sign in with Google</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  name: {
    color: '#a8c5b0',
    fontSize: 13,
    maxWidth: 140,
  },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#1a2e22',
    borderWidth: 1,
    borderColor: '#2e4d38',
  },
  googleBtn: {
    backgroundColor: '#1e3a28',
  },
  btnText: {
    color: '#7ec89a',
    fontSize: 13,
    fontWeight: '600',
  },
});
