// Family Tree Manager - Admin JavaScript
// Manages family members, relationships, and tree visualization

let currentMember = null;
let allMembers = [];
let allBranches = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await checkAdminAuth();
    await loadInitialData();
    setupEventListeners();
});

// Check admin authorization
async function checkAdminAuth() {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
        window.location.href = '../family-member-login.html';
        return;
    }

    // Check if user is admin
    const { data: adminData, error: adminError } = await supabase
        .from('admin_users')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (adminError || !adminData) {
        alert('Unauthorized: Admin access required');
        window.location.href = '../family-member-login.html';
        return;
    }
}

// Load all initial data
async function loadInitialData() {
    await Promise.all([
        loadMembers(),
        loadBranches(),
        loadStats()
    ]);
}

// Load all family members
async function loadMembers() {
    try {
        const { data, error } = await supabase
            .from('family_members')
            .select(`
                *,
                father:father_id(id, full_name),
                mother:mother_id(id, full_name),
                spouse:spouse_id(id, full_name),
                branch:family_branches(id, name, description)
            `)
            .order('generation', { ascending: true })
            .order('full_name', { ascending: true });

        if (error) throw error;

        allMembers = data || [];
        renderMembersTable(allMembers);
        populateParentSelects();
    } catch (error) {
        console.error('Failed to load members:', error);
        showError('Failed to load family members');
    }
}

// Load branches
async function loadBranches() {
    try {
        const { data, error } = await supabase
            .from('family_branches')
            .select('*')
            .order('name');

        if (error) throw error;
        allBranches = data || [];
    } catch (error) {
        console.error('Failed to load branches:', error);
    }
}

// Load statistics
async function loadStats() {
    try {
        // Total members
        const { count: totalCount } = await supabase
            .from('family_members')
            .select('*', { count: 'exact', head: true });

        // Living members
        const { count: livingCount } = await supabase
            .from('family_members')
            .select('*', { count: 'exact', head: true })
            .eq('living_status', 'living');

        // Max generation
        const { data: genData } = await supabase
            .from('family_members')
            .select('generation')
            .order('generation', { ascending: false })
            .limit(1);

        // Branches count
        const { count: branchCount } = await supabase
            .from('family_branches')
            .select('*', { count: 'exact', head: true });

        document.getElementById('totalMembers').textContent = totalCount || 0;
        document.getElementById('livingMembers').textContent = livingCount || 0;
        document.getElementById('generations').textContent = genData?.[0]?.generation + 1 || 0;
        document.getElementById('branches').textContent = branchCount || 0;
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

// Render members table
function renderMembersTable(members) {
    const tbody = document.getElementById('membersTableBody');
    
    if (!members || members.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 60px;">
                    <div style="opacity: 0.5;">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin: 0 auto 16px;">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                        </svg>
                        <h3 style="margin-bottom: 8px;">No Family Members</h3>
                        <p style="color: var(--muted);">Add your first family member to get started</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = members.map(member => {
        const initials = member.full_name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);

        const photoHtml = member.photo_url 
            ? `<img src="${member.photo_url}" alt="${member.full_name}">`
            : initials;

        const branchName = member.branch?.name || 'Unknown';
        const statusBadge = member.living_status === 'living' 
            ? '<span class="badge badge-success">Living</span>'
            : '<span class="badge badge-warning">Deceased</span>';

        return `
            <tr data-member-id="${member.id}">
                <td>
                    <div class="member-info">
                        <div class="member-avatar">${photoHtml}</div>
                        <div class="member-details">
                            <h4>${member.full_name}</h4>
                            <p>${member.nickname || 'No nickname'}</p>
                        </div>
                    </div>
                </td>
                <td>${member.relationship || '-'}</td>
                <td>${branchName}</td>
                <td>Gen ${member.generation || 0}</td>
                <td>${statusBadge}</td>
                <td>
                    <div class="action-buttons">
                        <button class="icon-button" onclick="editMember('${member.id}')" title="Edit">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="icon-button" onclick="viewMemberTree('${member.id}')" title="View Tree">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="8" r="7"></circle>
                                <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
                            </svg>
                        </button>
                        <button class="icon-button" onclick="createAccount('${member.id}')" title="Create Account">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="8.5" cy="7" r="4"></circle>
                                <line x1="20" y1="8" x2="20" y2="14"></line>
                                <line x1="23" y1="11" x2="17" y2="11"></line>
                            </svg>
                        </button>
                        <button class="icon-button" onclick="deleteMember('${member.id}')" title="Delete" style="color: var(--red);">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Populate parent select dropdowns
function populateParentSelects() {
    const fatherSelect = document.getElementById('fatherSelect');
    const motherSelect = document.getElementById('motherSelect');
    const spouseSelect = document.getElementById('spouseSelect');
    const branchSelect = document.getElementById('branchSelect');

    if (!fatherSelect || !motherSelect) return;

    // Males for father
    const males = allMembers.filter(m => m.gender === 'Male');
    fatherSelect.innerHTML = '<option value="">None (Root Member)</option>' + 
        males.map(m => `<option value="${m.id}">${m.full_name}</option>`).join('');

    // Females for mother
    const females = allMembers.filter(m => m.gender === 'Female');
    motherSelect.innerHTML = '<option value="">None (Root Member)</option>' + 
        females.map(m => `<option value="${m.id}">${m.full_name}</option>`).join('');

    // All members for spouse
    if (spouseSelect) {
        spouseSelect.innerHTML = '<option value="">None</option>' + 
            allMembers.map(m => `<option value="${m.id}">${m.full_name}</option>`).join('');
    }

    // Branches
    if (branchSelect && allBranches) {
        branchSelect.innerHTML = '<option value="">Select Branch</option>' + 
            allBranches.map(b => `<option value="${b.name}">${b.name.charAt(0).toUpperCase() + b.name.slice(1)}</option>`).join('');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Add member button
    document.getElementById('addMemberButton').addEventListener('click', () => {
        openMemberModal();
    });

    // Close modal
    document.getElementById('closeModal').addEventListener('click', closeMemberModal);
    document.getElementById('cancelButton').addEventListener('click', closeMemberModal);

    // Form submit
    document.getElementById('memberForm').addEventListener('submit', handleMemberSubmit);

    // Search
    document.getElementById('searchInput').addEventListener('input', handleSearch);

    // Modal backdrop click
    document.getElementById('memberModal').addEventListener('click', (e) => {
        if (e.target.id === 'memberModal') {
            closeMemberModal();
        }
    });
}

// Open member modal (add or edit)
function openMemberModal(member = null) {
    currentMember = member;
    const modal = document.getElementById('memberModal');
    const form = document.getElementById('memberForm');
    const title = document.getElementById('modalTitle');

    form.reset();
    populateParentSelects(); // Refresh selects

    if (member) {
        title.textContent = 'Edit Family Member';
        
        // Populate form with all available fields
        form.full_name.value = member.full_name || '';
        form.nickname.value = member.nickname || '';
        form.gender.value = member.gender || '';
        form.relationship.value = member.relationship || '';
        form.father_id.value = member.father_id || '';
        form.mother_id.value = member.mother_id || '';
        
        // Handle spouse_id if field exists
        if (form.spouse_id) {
            form.spouse_id.value = member.spouse_id || '';
        }
        
        form.branch.value = member.branch || '';
        form.generation.value = member.generation || 0;
        form.date_of_birth.value = member.date_of_birth || '';
        
        // Handle marriage_date if field exists
        if (form.marriage_date) {
            form.marriage_date.value = member.marriage_date || '';
        }
        
        form.living_status.value = member.living_status || 'living';
        form.occupation.value = member.occupation || '';
        
        // Handle additional fields if they exist
        if (form.education) form.education.value = member.education || '';
        if (form.blood_group) form.blood_group.value = member.blood_group || '';
        if (form.phone) form.phone.value = member.phone || '';
        if (form.email) form.email.value = member.email || '';
        if (form.address) form.address.value = member.address || '';
        
        form.biography.value = member.biography || '';
        
        if (form.notes) form.notes.value = member.notes || '';
    } else {
        title.textContent = 'Add Family Member';
        // Set default generation
        const maxGen = Math.max(...allMembers.map(m => m.generation || 0), 0);
        form.generation.value = maxGen + 1;
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Close member modal
function closeMemberModal() {
    const modal = document.getElementById('memberModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    currentMember = null;
}

// Handle member form submit
async function handleMemberSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    
    // Validate self-references
    const fatherId = formData.get('father_id') || null;
    const motherId = formData.get('mother_id') || null;
    const spouseId = formData.get('spouse_id') || null;
    
    if (currentMember) {
        if (fatherId === currentMember.id) {
            showError('A member cannot be their own father');
            return;
        }
        if (motherId === currentMember.id) {
            showError('A member cannot be their own mother');
            return;
        }
        if (spouseId === currentMember.id) {
            showError('A member cannot be their own spouse');
            return;
        }
    }
    
    const memberData = {
        full_name: formData.get('full_name'),
        nickname: formData.get('nickname') || null,
        gender: formData.get('gender'),
        relationship: formData.get('relationship'),
        father_id: fatherId,
        mother_id: motherId,
        spouse_id: spouseId,
        branch: formData.get('branch'),
        generation: parseInt(formData.get('generation')) || 0,
        date_of_birth: formData.get('date_of_birth') || null,
        marriage_date: formData.get('marriage_date') || null,
        living_status: formData.get('living_status') || 'living',
        occupation: formData.get('occupation') || null,
        education: formData.get('education') || null,
        blood_group: formData.get('blood_group') || null,
        phone: formData.get('phone') || null,
        email: formData.get('email') || null,
        address: formData.get('address') || null,
        biography: formData.get('biography') || null,
        notes: formData.get('notes') || null,
        is_visible: true
    };

    try {
        let result;

        if (currentMember) {
            // Update existing member
            result = await supabase
                .from('family_members')
                .update(memberData)
                .eq('id', currentMember.id)
                .select();
        } else {
            // Insert new member
            result = await supabase
                .from('family_members')
                .insert([memberData])
                .select();
        }

        if (result.error) throw result.error;

        showSuccess(currentMember ? 'Member updated successfully' : 'Member added successfully');
        closeMemberModal();
        await loadInitialData();
    } catch (error) {
        console.error('Failed to save member:', error);
        showError('Failed to save member: ' + error.message);
    }
}

// Edit member
window.editMember = function(memberId) {
    const member = allMembers.find(m => m.id === memberId);
    if (member) {
        openMemberModal(member);
    }
};

// Delete member
window.deleteMember = async function(memberId) {
    const member = allMembers.find(m => m.id === memberId);
    if (!member) return;
    
    // Check for dependent relationships
    const childrenCount = allMembers.filter(m => m.father_id === memberId || m.mother_id === memberId).length;
    const spouseCount = allMembers.filter(m => m.spouse_id === memberId).length;
    
    let warningMessage = `Are you sure you want to delete ${member.full_name}?`;
    
    if (childrenCount > 0 || spouseCount > 0) {
        warningMessage += `\n\n⚠️ WARNING: This member has:`;
        if (childrenCount > 0) warningMessage += `\n• ${childrenCount} child(ren)`;
        if (spouseCount > 0) warningMessage += `\n• ${spouseCount} spouse relationship(s)`;
        warningMessage += `\n\nThese relationships will be removed. This action cannot be undone.`;
    }
    
    if (!confirm(warningMessage)) {
        return;
    }

    try {
        // First, remove relationships to this member
        if (childrenCount > 0) {
            await supabase
                .from('family_members')
                .update({ 
                    father_id: null,
                    mother_id: null 
                })
                .or(`father_id.eq.${memberId},mother_id.eq.${memberId}`);
        }
        
        if (spouseCount > 0) {
            await supabase
                .from('family_members')
                .update({ spouse_id: null })
                .eq('spouse_id', memberId);
        }
        
        // Now delete the member
        const { error } = await supabase
            .from('family_members')
            .delete()
            .eq('id', memberId);

        if (error) throw error;

        showSuccess(`${member.full_name} deleted successfully`);
        await loadInitialData();
    } catch (error) {
        console.error('Failed to delete member:', error);
        showError('Failed to delete member: ' + error.message);
    }
};

// View member tree
window.viewMemberTree = function(memberId) {
    // Navigate to tree view focused on this member
    window.location.href = `family-tree-viewer.html?member=${memberId}`;
};

// Handle search
function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    
    if (!query) {
        renderMembersTable(allMembers);
        return;
    }

    const filtered = allMembers.filter(member => 
        member.full_name.toLowerCase().includes(query) ||
        (member.nickname && member.nickname.toLowerCase().includes(query)) ||
        (member.relationship && member.relationship.toLowerCase().includes(query))
    );

    renderMembersTable(filtered);
}

// Show success message
function showSuccess(message) {
    // Simple alert for now - can be replaced with toast notification
    alert(message);
}

// Show error message
function showError(message) {
    alert('Error: ' + message);
}


// Create account for family member
window.createAccount = async function(memberId) {
    const member = allMembers.find(m => m.id === memberId);
    if (!member) return;

    // Check if member already has an account
    const { data: existingAccount } = await supabase
        .from('family_member_accounts')
        .select('user_id')
        .eq('member_id', memberId)
        .single();

    if (existingAccount) {
        alert('This family member already has an account.');
        return;
    }

    // Prompt for email and password
    const email = prompt(`Create account for ${member.full_name}\n\nEnter email address:`);
    if (!email) return;

    const password = prompt('Enter password (min 6 characters):');
    if (!password || password.length < 6) {
        alert('Password must be at least 6 characters');
        return;
    }

    const confirmPassword = prompt('Confirm password:');
    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }

    // Call Edge Function
    try {
        const response = await fetch(
            'https://odjzahkfgkpkdoqkgbbg.supabase.co/functions/v1/create-family-member-auth',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${supabase.supabaseKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    memberId: memberId,
                    email: email,
                    password: password,
                    fullName: member.full_name
                })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to create account');
        }

        showSuccess(`Account created successfully for ${member.full_name}!\n\nEmail: ${email}\nPassword: ${password}\n\n⚠️ Save these credentials securely!`);
        await loadInitialData();
    } catch (error) {
        console.error('Failed to create account:', error);
        showError('Failed to create account: ' + error.message);
    }
};
