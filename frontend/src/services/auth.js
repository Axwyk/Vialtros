// Servicio para obtener el usuario actual y su rol
import axios from 'axios';

export async function getCurrentUser() {
  const token = localStorage.getItem('access');
  if (!token) return null;
  try {
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
    const res = await axios.get(`${apiUrl}/users/me/`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
  } catch {
    return null;
  }
}
