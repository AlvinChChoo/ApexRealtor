import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Plus,
  Search,
  Pencil,
  X,
  Loader2,
  Trash2,
} from "lucide-react";

type ProjectItem = {
  ProjectId: string;
  Subburb: string;
  ProjectName: string;
  ApplicationCnt: number;
};

type LocationItem = {
  StateName: string;
  Location: string;
};

const PROJECT_GET_URL = API_ENDPOINTS.PROJECT_GET;
const PROJECT_INSERT_URL = API_ENDPOINTS.PROJECT_INSERT;
const PROJECT_UPDATE_URL = API_ENDPOINTS.PROJECT_SET;
const PROJECT_DELETE_URL = API_ENDPOINTS.PROJECT_DELETE;
const LOCATION_GET_URL = API_ENDPOINTS.LOCATION_GET;

const Project: React.FC = () => {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [locationOptions, setLocationOptions] = useState<string[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const [loadingLocations, setLoadingLocations] = useState<boolean>(false);
  const [savingNew, setSavingNew] = useState<boolean>(false);
  const [savingEdit, setSavingEdit] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState<string>("");

  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  const [newProjectName, setNewProjectName] = useState<string>("");
  const [newSubburb, setNewSubburb] = useState<string>("");

  const [editProjectName, setEditProjectName] = useState<string>("");
  const [editSubburb, setEditSubburb] = useState<string>("");

  const [editingProject, setEditingProject] = useState<ProjectItem | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [deletingProject, setDeletingProject] = useState<ProjectItem | null>(null);

  useEffect(() => {
    fetchProjects();
    fetchLocations();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);

      const formData = new FormData();

      const response = await fetch(PROJECT_GET_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "success" && Array.isArray(data.data)) {
        setProjects(
          data.data.map((item: any) => ({
            ProjectId: String(item.ProjectId ?? ""),
            Subburb: String(item.Subburb ?? ""),
            ProjectName: String(item.ProjectName ?? ""),
            ApplicationCnt: Number(item.ApplicationCnt ?? 0),
          }))
        );
      } else if (data.status === "no_data_found") {
        setProjects([]);
      } else {
        throw new Error(data.error || "Unexpected response from ProjectGet.php");
      }
    } catch (err: any) {
      console.error("Error loading projects:", err);
      setError(err.message || "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      setLoadingLocations(true);

      const formData = new FormData();
      // If later you want to filter by state, can do:
      // formData.append("StateName", "Penang");

      const response = await fetch(LOCATION_GET_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "success" && Array.isArray(data.data)) {
        const mappedLocations = data.data
          .map((item: LocationItem) => String(item.Location ?? "").trim())
          .filter((item: string) => item !== "");

        const uniqueLocations = Array.from(new Set(mappedLocations)).sort((a, b) =>
          a.localeCompare(b)
        );

        setLocationOptions(uniqueLocations);
      } else if (data.status === "no_data_found") {
        setLocationOptions([]);
      } else {
        throw new Error(data.error || "Unexpected response from LocationGet.php");
      }
    } catch (err: any) {
      console.error("Error loading locations:", err);
      setLocationOptions([]);
      alert(err.message || "Failed to load locations.");
    } finally {
      setLoadingLocations(false);
    }
  };

  const filteredProjects = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return projects;

    return projects.filter(
      (p) =>
        p.ProjectName.toLowerCase().includes(term) ||
        (p.Subburb || "").toLowerCase().includes(term)
    );
  }, [projects, searchTerm]);

  const openAddModal = () => {
    setNewProjectName("");
    setNewSubburb("");
    setIsAddModalOpen(true);
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
    setNewProjectName("");
    setNewSubburb("");
  };

  const openEditModal = (project: ProjectItem) => {
    setEditingProject(project);
    setEditProjectName(project.ProjectName);
    setEditSubburb(project.Subburb ?? "");
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingProject(null);
    setEditProjectName("");
    setEditSubburb("");
  };

  const openDeleteModal = (project: ProjectItem) => {
    setDeletingProject(project);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setIsDeleteModalOpen(false);
    setDeletingProject(null);
  };

  const handleAddProject = async () => {
    const subburb = newSubburb.trim();
    const name = newProjectName.trim();

    if (!subburb) {
      alert("Please select a location.");
      return;
    }

    if (!name) {
      alert("Please enter a project name.");
      return;
    }

    try {
      setSavingNew(true);

      const formData = new FormData();
      formData.append("Subburb", subburb);
      formData.append("ProjectName", name);

      const response = await fetch(PROJECT_INSERT_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "success") {
        closeAddModal();
        await fetchProjects();
      } else {
        throw new Error(data.error || "Failed to insert project.");
      }
    } catch (err: any) {
      console.error("Error inserting project:", err);
      alert(err.message || "Failed to insert project.");
    } finally {
      setSavingNew(false);
    }
  };

  const handleUpdateProject = async () => {
    if (!editingProject) return;

    const subburb = editSubburb.trim();
    const name = editProjectName.trim();

    if (!subburb) {
      alert("Please select a location.");
      return;
    }

    if (!name) {
      alert("Please enter a project name.");
      return;
    }

    try {
      setSavingEdit(true);

      const formData = new FormData();
      formData.append("ProjectId", editingProject.ProjectId);
      formData.append("Subburb", subburb);
      formData.append("ProjectName", name);

      const response = await fetch(PROJECT_UPDATE_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "success") {
        closeEditModal();
        await fetchProjects();
      } else {
        throw new Error(data.error || "Failed to update project.");
      }
    } catch (err: any) {
      console.error("Error updating project:", err);
      alert(err.message || "Failed to update project.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!deletingProject) return;

    try {
      setDeleting(true);

      const formData = new FormData();
      formData.append("ProjectId", deletingProject.ProjectId);

      const response = await fetch(PROJECT_DELETE_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "success") {
        alert("Project deleted successfully.");
        closeDeleteModal();
        await fetchProjects();
      } else {
        throw new Error(data.error || "Failed to delete project.");
      }
    } catch (err: any) {
      console.error("Error deleting project:", err);
      alert(err.message || "Failed to delete project.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Briefcase className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Project</h1>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 mt-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                  <Search className="w-4 h-4 text-gray-400" />
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search project name..."
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <button
                type="button"
                onClick={fetchProjects}
                className="shrink-0 inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-60"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    REFRESH PROJECT LIST
                  </>
                ) : (
                  "REFRESH PROJECT LIST"
                )}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={openAddModal}
            className="shrink-0 inline-flex items-center space-x-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Project</span>
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
            <span className="ml-2 text-sm text-gray-600">Loading projects...</span>
          </div>
        ) : (
          <div className="mt-4">
            {filteredProjects.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 py-8 text-center text-sm text-gray-500">
                No projects found.
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
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Project Name
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Usage
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {filteredProjects.map((project, index) => (
                      <tr key={project.ProjectId || index}>
                        <td className="px-4 py-2 text-sm text-gray-600">{index + 1}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{project.Subburb || "-"}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{project.ProjectName}</td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">
                          {project.ApplicationCnt ?? 0}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(project)}
                              className="inline-flex items-center rounded-full border border-gray-300 bg-white p-1.5 text-gray-600 hover:border-blue-500 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                              title="Edit project"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            {(project.ApplicationCnt ?? 0) <= 0 && (
                              <button
                                type="button"
                                onClick={() => openDeleteModal(project)}
                                className="inline-flex items-center rounded-full border border-gray-300 bg-white p-1.5 text-gray-600 hover:border-red-500 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                                title="Delete project"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add New Project</h3>
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
                <select
                  value={newSubburb}
                  onChange={(e) => setNewSubburb(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={savingNew || loadingLocations}
                >
                  <option value="">
                    {loadingLocations ? "Loading locations..." : "-- Select Location --"}
                  </option>
                  {locationOptions.map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Enter project name"
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
                  onClick={handleAddProject}
                  className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-60"
                  disabled={savingNew || loadingLocations}
                >
                  {savingNew && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save as New Project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Edit Project</h3>
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

                <select
                  value={editSubburb}
                  onChange={(e) => setEditSubburb(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={savingEdit || loadingLocations}
                >
                  <option value="">
                    {loadingLocations ? "Loading locations..." : "-- Select Location --"}
                  </option>
                  {locationOptions.map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editProjectName}
                  onChange={(e) => setEditProjectName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Enter project name"
                  disabled={savingEdit}
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
                  onClick={handleUpdateProject}
                  className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-60"
                  disabled={savingEdit || loadingLocations}
                >
                  {savingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update Project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isDeleteModalOpen && deletingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
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
              Are you sure to delete this project{" "}
              <span className="font-semibold text-gray-900">
                "{deletingProject.ProjectName}"
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
                onClick={handleDeleteProject}
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

export default Project;