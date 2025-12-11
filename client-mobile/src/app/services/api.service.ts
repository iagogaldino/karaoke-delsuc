import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface QRCodeStatus {
  qrId: string;
  isValid: boolean;
  nameSubmitted: boolean;
  userName?: string;
  userPhone?: string;
  userPhoto?: string;
  createdAt: number;
  expiresAt: number;
  songSelected?: boolean;
  songId?: string;
  song?: {
    id: string;
    name: string;
    displayName?: string;
    artist?: string;
    duration: number;
  };
}

export interface Song {
  id: string;
  name: string;
  displayName?: string;
  artist?: string;
  duration: number;
  status: {
    ready: boolean;
  };
}

export interface SongsResponse {
  songs: Song[];
}

export interface User {
  name: string;
  phone: string;
  photo?: string;
  createdAt?: string;
  lastPlayedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = '/api';

  constructor(private http: HttpClient) {}

  getQRCodeStatus(qrId: string): Observable<QRCodeStatus> {
    return this.http.get<QRCodeStatus>(`${this.apiUrl}/qrcode/${qrId}/status`);
  }

  submitName(qrId: string, userName: string, userPhone: string, userPhoto: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/qrcode/${qrId}/name`, {
      userName,
      userPhone,
      userPhoto
    });
  }

  uploadPhoto(qrId: string, photo: File): Observable<{ photo: string; fileName: string }> {
    const formData = new FormData();
    formData.append('photo', photo);
    return this.http.post<{ photo: string; fileName: string }>(`${this.apiUrl}/users/upload-photo/${qrId}`, formData);
  }

  getUserByPhone(phone: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/users/by-phone/${encodeURIComponent(phone)}`);
  }

  getAllSongs(): Observable<SongsResponse> {
    return this.http.get<SongsResponse>(`${this.apiUrl}/songs`);
  }

  selectSong(qrId: string, songId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/qrcode/${qrId}/song`, { songId });
  }

  giveUp(qrId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/qrcode/${qrId}/giveup`, {});
  }
}

