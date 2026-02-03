'use client';

/**
 * VOD Review Panel for Lumina
 * Similar to Mosaic's VOD Analysis but integrated into game/round views
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Film, Play, Clock, Star, Upload, Loader2 } from 'lucide-react';

interface VODReviewPanelProps {
  gameId: string;
  roundNumber?: number;
}

// Mock data - in production this would come from API
const MOCK_VOD = {
  videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  keyMoments: [
    { timestamp: 10, title: 'Eco Round Win', type: 'strategic' },
    { timestamp: 30, title: 'Clutch 1v2', type: 'clutch' },
    { timestamp: 60, title: 'Perfect Execute', type: 'execute' },
  ],
  analysis: {
    strengths: ['Excellent utility coordination', 'Strong post-plant positioning'],
    improvements: ['Faster rotations needed', 'Better trade discipline'],
  },
};

export function VODReviewPanel({ gameId, roundNumber }: VODReviewPanelProps) {
  const [hasVOD, setHasVOD] = useState(true); // Demo mode
  const [isUploading, setIsUploading] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const handleUpload = () => {
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      setHasVOD(true);
    }, 2000);
  };

  if (!hasVOD) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="h-5 w-5" />
            VOD Review
          </CardTitle>
          <CardDescription>Upload a VOD for this game to enable review</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleUpload} disabled={isUploading} className="w-full">
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload VOD
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Video Player */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Film className="h-5 w-5" />
              VOD Review {roundNumber && `- Round ${roundNumber}`}
            </CardTitle>
            <Badge variant="outline">AI Analysis Ready</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <video className="w-full h-full" controls src={MOCK_VOD.videoUrl} />
          </div>
          <Button variant="outline" className="w-full" onClick={() => setShowAnalysis(!showAnalysis)}>
            {showAnalysis ? 'Hide' : 'Show'} AI Analysis
          </Button>
        </CardContent>
      </Card>

      {/* AI Analysis */}
      {showAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-sm mb-2 text-green-600">Strengths</h4>
              <ul className="space-y-1">
                {MOCK_VOD.analysis.strengths.map((s, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="text-green-600">•</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2 text-amber-600">Areas for Improvement</h4>
              <ul className="space-y-1">
                {MOCK_VOD.analysis.improvements.map((i, idx) => (
                  <li key={idx} className="text-sm flex items-start gap-2">
                    <span className="text-amber-600">•</span>
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Moments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Key Moments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {MOCK_VOD.keyMoments.map((moment, i) => (
              <button
                key={i}
                className="w-full flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                onClick={() => {
                  const video = document.querySelector('video');
                  if (video) video.currentTime = moment.timestamp;
                }}
              >
                <Star className="h-4 w-4 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-medium text-sm">{moment.title}</div>
                  <div className="text-xs text-muted-foreground">{moment.type}</div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {Math.floor(moment.timestamp / 60)}:{(moment.timestamp % 60).toString().padStart(2, '0')}
                </div>
                <Play className="h-4 w-4" />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
