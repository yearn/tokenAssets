import React, { useEffect } from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { rootRoute } from '../../router';

const GithubSuccessComponent: React.FC = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const state = params.get('state');
    const returnedState = sessionStorage.getItem('auth_state');
    if (state && returnedState && state !== returnedState) {
      console.warn('OAuth state mismatch.');
    }
    if (token) {
      sessionStorage.setItem('github_token', token);
    }
    navigate({ to: '/' });
  }, [navigate]);

  return <p>Signing you in…</p>;
};

export const GithubSuccessRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/github/success',
  component: GithubSuccessComponent,
});
