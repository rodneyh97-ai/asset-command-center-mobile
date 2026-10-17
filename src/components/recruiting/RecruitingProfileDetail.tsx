'use client';

import { useState } from 'react';
import { useRecruitingStore } from '@/stores/recruiting-store';
import type { RecruitingProfile, SharingVisibility } from '@/domain/types';

interface Props {
  profile: RecruitingProfile;
  playerName: string;
  onBack: () => void;
}

const VISIBILITY_LABELS: Record<SharingVisibility, { label: string; style: string; description: string }> = {
  private: { label: 'Private', style: 'bg-slate-600/60 text-slate-300', description: 'Only visible to coaching staff' },
  'guardian-approved': { label: 'Guardian Approved', style: 'bg-amber-500/20 text-amber-400', description: 'Shared with guardian approval' },
  public: { label: 'Public', style: 'bg-green-500/20 text-green-400', description: 'Visible to college coaches' },
};

export default function RecruitingProfileDetail({ profile, playerName, onBack }: Props) {
  const { updateProfile, addSchool, removeSchool, setVisibility, deleteProfile } = useRecruitingStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);
  const [newSchool, setNewSchool] = useState('');
  const [showVisibilityPicker, setShowVisibilityPicker] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSave = async () => {
    await updateProfile(profile.id, {
      graduationYear: draft.graduationYear,
      gpa: draft.gpa,
      height: draft.height,
      reach: draft.reach,
      verticalJump: draft.verticalJump,
      clubName: draft.clubName,
      contactEmail: draft.contactEmail,
      guardianEmail: draft.guardianEmail,
      bio: draft.bio,
    });
    setEditing(false);
  };

  const handleAddSchool = () => {
    if (!newSchool.trim()) return;
    addSchool(profile.id, newSchool.trim());
    setNewSchool('');
  };

  const handleShare = async () => {
    if (profile.visibility === 'private') return;

    const lines: string[] = [];
    lines.push(`RECRUITING PROFILE: ${playerName}`);
    lines.push(`Graduation Year: ${profile.graduationYear}`);
    if (profile.clubName) lines.push(`Club: ${profile.clubName}`);
    if (profile.height) lines.push(`Height: ${profile.height}`);
    if (profile.reach) lines.push(`Reach: ${profile.reach}`);
    if (profile.verticalJump) lines.push(`Vertical: ${profile.verticalJump}`);
    if (profile.gpa) lines.push(`GPA: ${profile.gpa}`);
    lines.push('');
    if (profile.bio) {
      lines.push('BIO:');
      lines.push(profile.bio);
      lines.push('');
    }
    if (profile.interestedSchools.length > 0) {
      lines.push('INTERESTED SCHOOLS:');
      profile.interestedSchools.forEach((s) => lines.push(`  - ${s}`));
      lines.push('');
    }
    if (profile.contactEmail) lines.push(`Contact: ${profile.contactEmail}`);

    const text = lines.join('\n');
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: `${playerName} - Recruiting Profile`, text });
        return;
      } catch {
        // Fall through to clipboard
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const visInfo = VISIBILITY_LABELS[profile.visibility];

  return (
    <div className="flex flex-col p-6 max-w-4xl mx-auto w-full">
      <button onClick={onBack} className="text-blue-400 hover:text-blue-300 mb-4 text-sm text-left">
        {'<'} Back to Recruiting Profiles
      </button>

      {/* Header */}
      <div className="bg-slate-800 rounded-2xl p-5 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{playerName}</h1>
            <p className="text-sm text-slate-400 mt-1">Class of {profile.graduationYear}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowVisibilityPicker(!showVisibilityPicker)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium ${visInfo.style}`}
            >
              {visInfo.label}
            </button>
            {!editing && (
              <button
                onClick={() => { setDraft(profile); setEditing(true); }}
                className="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg text-sm"
              >
                Edit
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">{visInfo.description}</p>
      </div>

      {/* Visibility Picker */}
      {showVisibilityPicker && (
        <div className="bg-slate-800 rounded-xl p-4 mb-4 border border-slate-700/50">
          <p className="text-sm font-semibold mb-3">Privacy Level</p>
          <div className="space-y-2">
            {(Object.entries(VISIBILITY_LABELS) as [SharingVisibility, typeof visInfo][]).map(([key, info]) => (
              <button
                key={key}
                onClick={() => { setVisibility(profile.id, key); setShowVisibilityPicker(false); }}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-colors ${
                  profile.visibility === key ? info.style : 'bg-slate-700/50 hover:bg-slate-700 text-slate-300'
                }`}
              >
                <div className="font-medium">{info.label}</div>
                <div className="text-xs opacity-75 mt-0.5">{info.description}</div>
              </button>
            ))}
          </div>
          {profile.visibility !== 'private' && !profile.guardianApproved && (
            <div className="mt-3 bg-amber-900/30 border border-amber-700/50 rounded-lg p-3">
              <p className="text-xs text-amber-400">
                Guardian approval required before sharing. Send the guardian approval request via email.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Share button */}
      {profile.visibility !== 'private' && (
        <button
          onClick={handleShare}
          disabled={!profile.guardianApproved && profile.visibility === 'guardian-approved'}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 py-3 rounded-xl font-medium text-sm mb-4 touch-manipulation"
        >
          {copied ? 'Copied to clipboard!' : 'Share Profile'}
        </button>
      )}

      {/* Profile Info */}
      {editing ? (
        <div className="bg-slate-800 rounded-xl p-4 mb-4 border border-slate-700/50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Graduation Year</label>
              <input
                type="number"
                value={draft.graduationYear}
                onChange={(e) => setDraft({ ...draft, graduationYear: Number(e.target.value) })}
                className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">GPA</label>
              <input
                type="text"
                value={draft.gpa || ''}
                onChange={(e) => setDraft({ ...draft, gpa: e.target.value })}
                placeholder="e.g. 3.8"
                className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 min-h-[44px]"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Height</label>
              <input
                type="text"
                value={draft.height || ''}
                onChange={(e) => setDraft({ ...draft, height: e.target.value })}
                placeholder={`5'10"`}
                className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Reach</label>
              <input
                type="text"
                value={draft.reach || ''}
                onChange={(e) => setDraft({ ...draft, reach: e.target.value })}
                placeholder={`7'8"`}
                className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Vertical</label>
              <input
                type="text"
                value={draft.verticalJump || ''}
                onChange={(e) => setDraft({ ...draft, verticalJump: e.target.value })}
                placeholder={`24"`}
                className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 min-h-[44px]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Club Name</label>
              <input
                type="text"
                value={draft.clubName || ''}
                onChange={(e) => setDraft({ ...draft, clubName: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Contact Email</label>
              <input
                type="email"
                value={draft.contactEmail || ''}
                onChange={(e) => setDraft({ ...draft, contactEmail: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm min-h-[44px]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Guardian Email</label>
            <input
              type="email"
              value={draft.guardianEmail || ''}
              onChange={(e) => setDraft({ ...draft, guardianEmail: e.target.value })}
              placeholder="Required for sharing profiles of minor athletes"
              className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Bio</label>
            <textarea
              value={draft.bio}
              onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
              placeholder="Athletic background, achievements, goals..."
              rows={4}
              className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 resize-none"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setEditing(false)}
              className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-xl font-medium text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-medium text-sm"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-xl p-4 mb-4 border border-slate-700/50">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {profile.gpa && <div><span className="text-slate-400">GPA:</span> {profile.gpa}</div>}
            {profile.height && <div><span className="text-slate-400">Height:</span> {profile.height}</div>}
            {profile.reach && <div><span className="text-slate-400">Reach:</span> {profile.reach}</div>}
            {profile.verticalJump && <div><span className="text-slate-400">Vertical:</span> {profile.verticalJump}</div>}
            {profile.clubName && <div><span className="text-slate-400">Club:</span> {profile.clubName}</div>}
            {profile.contactEmail && <div><span className="text-slate-400">Email:</span> {profile.contactEmail}</div>}
          </div>
          {profile.guardianEmail && (
            <div className="mt-3 text-sm">
              <span className="text-slate-400">Guardian:</span> {profile.guardianEmail}
              {profile.guardianApproved ? (
                <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Approved</span>
              ) : (
                <span className="ml-2 text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">Pending</span>
              )}
            </div>
          )}
          {profile.bio && (
            <div className="mt-4">
              <p className="text-xs font-medium text-slate-400 mb-1">Bio</p>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{profile.bio}</p>
            </div>
          )}
        </div>
      )}

      {/* Interested Schools */}
      <div className="mb-4">
        <h2 className="text-lg font-bold mb-3">Interested Schools</h2>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newSchool}
            onChange={(e) => setNewSchool(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddSchool()}
            placeholder="Add a school..."
            className="flex-1 bg-slate-700 border border-slate-600/50 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 min-h-[44px]"
          />
          <button
            onClick={handleAddSchool}
            disabled={!newSchool.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 px-4 rounded-lg text-sm font-medium"
          >
            Add
          </button>
        </div>
        {profile.interestedSchools.length === 0 ? (
          <div className="bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-xl p-6 text-center">
            <p className="text-sm text-slate-500">No schools added yet.</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {profile.interestedSchools.map((school) => (
              <div
                key={school}
                className="bg-slate-800 border border-slate-700/50 rounded-lg px-3 py-2 flex items-center gap-2"
              >
                <span className="text-sm">{school}</span>
                <button
                  onClick={() => removeSchool(profile.id, school)}
                  className="text-slate-500 hover:text-red-400 text-xs"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Linked Highlight Reels */}
      <div className="mb-4">
        <h2 className="text-lg font-bold mb-3">Linked Highlight Reels</h2>
        {profile.highlightReelIds.length === 0 ? (
          <div className="bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-xl p-6 text-center">
            <p className="text-sm text-slate-500">No highlight reels linked. Create one from the Highlights page.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {profile.highlightReelIds.map((reelId) => (
              <div key={reelId} className="bg-slate-800 rounded-xl p-3 border border-slate-700/50 text-sm text-slate-300">
                Reel: {reelId.slice(0, 8)}...
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={() => { deleteProfile(profile.id); onBack(); }}
        className="w-full bg-red-600/20 hover:bg-red-600/30 text-red-400 py-3 rounded-xl font-medium text-sm mt-4 touch-manipulation"
      >
        Delete Profile
      </button>
    </div>
  );
}
