import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { User } from '../models/index.js';

interface UserDoc {
  _id: { toString(): string };
  email: string;
  password?: string;
  role: string;
  status: string;
  displayName?: string;
  approvalToken?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  tokenVersion?: number;
  createdAt: Date;
  lastLogin?: Date;
}

interface UserData {
  id: string;
  email: string;
  password?: string;
  role: string;
  status: string;
  displayName?: string;
  approvalToken?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  tokenVersion?: number;
  createdAt: Date;
  lastLogin?: Date;
}

function mapUserDoc(doc: UserDoc): UserData {
  return {
    id: doc._id.toString(),
    email: doc.email,
    password: doc.password,
    role: doc.role,
    status: doc.status,
    displayName: doc.displayName,
    approvalToken: doc.approvalToken,
    resetPasswordToken: doc.resetPasswordToken,
    resetPasswordExpires: doc.resetPasswordExpires,
    tokenVersion: doc.tokenVersion,
    createdAt: doc.createdAt,
    lastLogin: doc.lastLogin,
  };
}

export async function createUser(email: string, password: string, displayName?: string): Promise<UserData> {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new Error('User already exists');
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const approvalToken = uuidv4();

  const user = await User.create({
    email: email.toLowerCase(),
    password: hashedPassword,
    displayName,
    role: 'user',
    status: 'pending',
    approvalToken,
  });

  return mapUserDoc(user as unknown as UserDoc);
}

export async function getUserByEmail(email: string): Promise<UserData | null> {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password').lean() as unknown as UserDoc | null;
  if (!user) return null;
  return mapUserDoc(user);
}

export async function getUserById(userId: string): Promise<UserData | null> {
  const user = await User.findById(userId).lean() as unknown as UserDoc | null;
  if (!user) return null;
  return mapUserDoc(user);
}

export async function findUserByApprovalToken(token: string): Promise<UserData | null> {
  const user = await User.findOne({ approvalToken: token }).lean() as unknown as UserDoc | null;
  if (!user) return null;
  return mapUserDoc(user);
}

export async function approveUser(userId: string): Promise<void> {
  await User.findByIdAndUpdate(userId, { status: 'approved', approvalToken: null });
}

export async function rejectUser(userId: string): Promise<void> {
  await User.findByIdAndUpdate(userId, {
    status: 'rejected',
    approvalToken: null,
    $inc: { tokenVersion: 1 },
  });
}

export async function verifyPassword(user: { password?: string }, password: string): Promise<boolean> {
  if (!user.password) return false;
  return bcrypt.compare(password, user.password);
}

export async function updateLastLogin(userId: string): Promise<void> {
  await User.findByIdAndUpdate(userId, { lastLogin: new Date() });
}

export async function getAllUsers(): Promise<UserData[]> {
  const users = await User.find().sort({ createdAt: -1 }).lean() as unknown as UserDoc[];
  return users.map(mapUserDoc);
}

export async function getPendingUsers(): Promise<UserData[]> {
  const users = await User.find({ status: 'pending' }).sort({ createdAt: -1 }).lean() as unknown as UserDoc[];
  return users.map(mapUserDoc);
}

export async function setResetToken(email: string): Promise<UserData | null> {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return null;

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 3600000); // 1 hour

  await User.findByIdAndUpdate(user._id, {
    resetPasswordToken: token,
    resetPasswordExpires: expires,
  });

  return { ...mapUserDoc(user as unknown as UserDoc), resetPasswordToken: token, resetPasswordExpires: expires };
}

export async function findByResetToken(token: string): Promise<UserData | null> {
  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: new Date() },
  }).select('+password').lean() as unknown as UserDoc | null;
  if (!user) return null;
  return mapUserDoc(user);
}

export async function updatePassword(userId: string, newPassword: string): Promise<void> {
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await User.findByIdAndUpdate(userId, {
    password: hashedPassword,
    resetPasswordToken: null,
    resetPasswordExpires: null,
  });
}