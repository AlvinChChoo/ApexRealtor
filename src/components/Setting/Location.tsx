import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useEffect, useState } from "react";
import { MapPin, Plus, Pencil, X, Loader2, Trash2 } from "lucide-react";

type LocationItem = {
  StateName: string;
  Location: string;
};

const LOCATION_GET_URL = API_ENDPOINTS.LOCATION_GET;
const LOCATION_INSERT_URL = API_ENDPOINTS.LOCATION_INSERT;
const LOCATION_UPDATE_URL = API_ENDPOINTS.LOCATION_SET;
const LOCATION_DELETE_URL = API_ENDPOINTS.LOCATION_DELETE;

const Location: React.FC = () => {
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [savingNew, setSavingNew] = useState<boolean>(false);
  const [savingEdit, setSavingEdit] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);

  const [newStateName, setNewStateName] = useState<string>("");
  const [newLocationName, setNewLocationName] = useState<string>("");

  const [editStateName, setEditStateName] = useState<string>("");
  const [editLocationName, setEditLocationName] = useState<string>("");

  const [editingLocation, setEditingLocation] = useState<LocationItem | null>(null);
  const [deletingLocation, setDeletingLocation] = useState<LocationItem | null>(null);

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(LOCATION_GET_URL, {
        method: "POST",
        body: new FormData(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "success" && Array.isArray(data.data)) {
        setLocations(
          data.data.map((item: any) => ({
            StateName: String(item.StateName ?? ""),
            Location: String(item.Location ?? ""),
          }))
        );
      } else if (data.status === "no_data_found") {
        setLocations([]);
      } else {
        throw new Error(data.error || "Unexpected response from LocationGet.php");
      }
    } catch (err: any) {
      console.error("Error loading locations:", err);
      setError(err.message || "Failed to load locations.");
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setNewStateName("");
    setNewLocationName("");
    setIsAddModalOpen(true);
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
    setNewStateName("");
    setNewLocationName("");
  };

  const openEditModal = (location: LocationItem) => {
    setEditingLocation(location);
    setEditStateName(location.StateName);
    setEditLocationName(location.Location);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingLocation(null);
    setEditStateName("");
    setEditLocationName("");
  };

  const openDeleteModal = (location: LocationItem) => {
    setDeletingLocation(location);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setIsDeleteModalOpen(false);
    setDeletingLocation(null);
  };

  const handleAddLocation = async () => {
    const stateName = newStateName.trim();
    const locationName = newLocationName.trim();

    if (!locationName) {
      alert("Please enter location name.");
      return;
    }

    try {
      setSavingNew(true);

      const formData = new FormData();
      formData.append("StateName", 'Penang');
      formData.append("Location", locationName);

      const response = await fetch(LOCATION_INSERT_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "success") {
        closeAddModal();
        await fetchLocations();
      } else {
        throw new Error(data.error || "Failed to insert location.");
      }
    } catch (err: any) {
      console.error("Error inserting location:", err);
      alert(err.message || "Failed to insert location.");
    } finally {
      setSavingNew(false);
    }
  };

  const handleUpdateLocation = async () => {
    if (!editingLocation) return;

    const stateName = editStateName.trim();
    const locationName = editLocationName.trim();

    if (!stateName) {
      alert("Please enter state name.");
      return;
    }

    if (!locationName) {
      alert("Please enter location name.");
      return;
    }

    try {
      setSavingEdit(true);

      const formData = new FormData();
      formData.append("OldStateName", 'Penang');
      formData.append("OldLocation", editingLocation.Location);
      formData.append("StateName", 'Penang');
      formData.append("Location", locationName);

      const response = await fetch(LOCATION_UPDATE_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "success") {
        closeEditModal();
        await fetchLocations();
      } else {
        throw new Error(data.error || "Failed to update location.");
      }
    } catch (err: any) {
      console.error("Error updating location:", err);
      alert(err.message || "Failed to update location.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteLocation = async () => {
    if (!deletingLocation) return;

    try {
      setDeleting(true);

      const formData = new FormData();
      formData.append("StateName", deletingLocation.StateName);
      formData.append("Location", deletingLocation.Location);

      const response = await fetch(LOCATION_DELETE_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "success") {
        alert("Location deleted successfully.");
        closeDeleteModal();
        await fetchLocations();
      } else {
        throw new Error(data.error || "Failed to delete location.");
      }
    } catch (err: any) {
      console.error("Error deleting location:", err);
      alert(err.message || "Failed to delete location.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <MapPin className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Location</h1>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
        <div className="flex items-center justify-end gap-3 flex-wrap">
          <button
            type="button"
            onClick={fetchLocations}
            className="shrink-0 inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                REFRESH LOCATION LIST
              </>
            ) : (
              "REFRESH LOCATION LIST"
            )}
          </button>

          <button
            type="button"
            onClick={openAddModal}
            className="shrink-0 inline-flex items-center space-x-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Location</span>
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="ml-2 text-sm text-gray-600">Loading locations...</span>
          </div>
        ) : (
          <div className="mt-4">
            {locations.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 py-8 text-center text-sm text-gray-500">
                No locations found.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        #
                      </th>
                      
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Location
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {locations.map((location, index) => (
                      <tr key={`${location.StateName}-${location.Location}-${index}`}>
                        <td className="px-4 py-2 text-sm text-gray-600">{index + 1}</td>                        
                        <td className="px-4 py-2 text-sm text-gray-900">{location.Location}</td>
                        <td className="px-4 py-2 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(location)}
                              className="inline-flex items-center rounded-full border border-gray-300 bg-white p-1.5 text-gray-600 hover:border-blue-500 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                              title="Edit location"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => openDeleteModal(location)}
                              className="inline-flex items-center rounded-full border border-gray-300 bg-white p-1.5 text-gray-600 hover:border-red-500 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                              title="Delete location"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Add New Location</h3>
              <button
                type="button"
                onClick={closeAddModal}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Location <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Enter location name"
                />
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  disabled={savingNew}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddLocation}
                  className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-60"
                  disabled={savingNew}
                >
                  {savingNew && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save as New Location
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && editingLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Edit Location</h3>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">              
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Location <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editLocationName}
                  onChange={(e) => setEditLocationName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Enter location name"
                />
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  disabled={savingEdit}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateLocation}
                  className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-60"
                  disabled={savingEdit}
                >
                  {savingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update Location
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isDeleteModalOpen && deletingLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Confirm Delete</h3>
              <button
                type="button"
                onClick={closeDeleteModal}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                disabled={deleting}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-sm text-gray-700">
              Are you sure to delete location{" "}
              <span className="font-semibold text-gray-900">
                "{deletingLocation.Location}"
              </span>{" "}
              under state{" "}
              <span className="font-semibold text-gray-900">
                "{deletingLocation.StateName}"
              </span>
              ?
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={deleting}
              >
                No
              </button>

              <button
                type="button"
                onClick={handleDeleteLocation}
                className="inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 disabled:opacity-60"
                disabled={deleting}
              >
                {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Location;