import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { AssetsPage } from './pages/AssetsPage'
import { IncidentsPage } from './pages/IncidentsPage'
import { ChangesPage } from './pages/ChangesPage'
import { ConnectorsPage } from './pages/ConnectorsPage'
import { VulnerabilitiesPage } from './pages/VulnerabilitiesPage'
import { InfrastructurePage } from './pages/InfrastructurePage'

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout>
                  <DashboardPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/assets"
            element={
              <ProtectedRoute>
                <Layout>
                  <AssetsPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/incidents"
            element={
              <ProtectedRoute>
                <Layout>
                  <IncidentsPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/changes"
            element={
              <ProtectedRoute>
                <Layout>
                  <ChangesPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/connectors"
            element={
              <ProtectedRoute>
                <Layout>
                  <ConnectorsPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/vulnerabilities"
            element={
              <ProtectedRoute>
                <Layout>
                  <VulnerabilitiesPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/infrastructure"
            element={
              <ProtectedRoute>
                <Layout>
                  <InfrastructurePage />
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
