"use client";

import { useState } from "react";
import { Avatar } from "@heroui/avatar";

interface UserAvatarProps {
  name: string | null | undefined;
  email: string | null | undefined;
  image: string | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
  as?: "button" | "div";
  showFallback?: boolean;
}

/**
 * UserAvatar component with error handling for OAuth profile images
 * Handles 429 rate limit errors from Google/GitHub/Apple CDNs by falling back to initials
 */
export function UserAvatar({
  name,
  email,
  image,
  size = "sm",
  className = "",
  as,
  showFallback = true,
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);

  // Don't use image if it previously failed to load
  const avatarSrc = image && !imageError ? image : undefined;

  // Generate fallback name from name or email
  const fallbackName = name || email || "User";

  return (
    <Avatar
      as={as}
      className={className}
      imgProps={{
        onError: () => {
          // Handle image load errors (including 429 rate limits)
          setImageError(true);
        },
      }}
      name={fallbackName}
      showFallback={showFallback}
      size={size}
      src={avatarSrc}
    />
  );
}
